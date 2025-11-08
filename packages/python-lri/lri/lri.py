"""
LRI main class for FastAPI integration
"""

import base64
import json
from typing import Awaitable, Callable, Optional
from fastapi import Request, HTTPException
from .types import LCE
from .validator import validate_lce


class LRI:
    """
    LRI handler for FastAPI applications

    Example:
        ```python
        from fastapi import FastAPI, Request
        from lri import LRI

        app = FastAPI()
        lri = LRI()

        @app.get("/api/data")
        async def get_data(request: Request):
            lce = await lri.parse_request(request, required=False)
            return {"ok": True, "lce": lce}
        ```
    """

    def __init__(self, header_name: str = "LCE", validate: bool = True):
        """
        Initialize LRI handler

        Args:
            header_name: HTTP header name for LCE (default: "LCE")
            validate: Validate LCE against schema (default: True)
        """
        self.header_name = header_name
        self.validate = validate

    async def parse_request(
        self, request: Request, required: bool = False
    ) -> Optional[LCE]:
        """
        Parse LCE from request header

        Args:
            request: FastAPI Request object
            required: Raise 428 if LCE is missing

        Returns:
            Parsed LCE object or None

        Raises:
            HTTPException: 400 (malformed), 422 (invalid), 428 (missing)
        """
        b64 = request.headers.get(self.header_name)

        if not b64:
            if required:
                raise HTTPException(
                    status_code=428,
                    detail={
                        "error": "LCE header required",
                        "header": self.header_name,
                    },
                )
            return None

        try:
            json_str = base64.b64decode(b64).decode("utf-8")
            data = json.loads(json_str)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Malformed LCE header",
                    "message": str(e),
                },
            )

        if self.validate:
            errors = validate_lce(data)
            if errors:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "error": "Invalid LCE",
                        "details": errors,
                    },
                )

        try:
            return LCE.model_validate(data)
        except Exception as e:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "LCE validation failed",
                    "message": str(e),
                },
            )

    def dependency(self, required: bool = False) -> Callable[[Request], Awaitable[Optional[LCE]]]:
        """Return a FastAPI dependency for parsing LCE headers.

        Args:
            required: When ``True`` the dependency raises ``HTTPException`` with
                status code ``428`` if the header is missing. Defaults to
                ``False`` so routes can degrade gracefully when the header is
                absent.

        Returns:
            Callable that FastAPI can use with ``Depends`` to inject an
            ``Optional[LCE]`` into the route handler.
        """

        async def _dependency(request: Request) -> Optional[LCE]:
            return await self.parse_request(request, required=required)

        return _dependency

    @staticmethod
    def create_header(lce: LCE) -> str:
        """
        Create Base64-encoded LCE header value

        Args:
            lce: LCE object to encode

        Returns:
            Base64-encoded JSON string
        """
        json_str = lce.model_dump_json(exclude_none=True)
        return base64.b64encode(json_str.encode("utf-8")).decode("utf-8")
