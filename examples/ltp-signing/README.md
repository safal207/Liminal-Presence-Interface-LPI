# LTP Signing Example

Демонстрация **LTP (Liminal Trust Protocol)** - криптографических подписей для LCE сообщений.

## Что такое LTP?

LTP обеспечивает:
- **Аутентификацию** - подтверждение отправителя
- **Целостность** - обнаружение изменений
- **Неотказуемость** - невозможность отрицать отправку

## Технологии

- **Ed25519** - современная криптография с эллиптическими кривыми
- **JWS** - JSON Web Signature (RFC 7515)
- **JCS** - JSON Canonicalization Scheme (RFC 8785)

## Запуск примера

```bash
cd examples/ltp-signing
npm install
npm start
```

## Вывод

```
=== LTP (Liminal Trust Protocol) Example ===

1. Generating Ed25519 key pair...
✓ Keys generated
  Public key (JWK):
   {
     "kty": "OKP",
     "crv": "Ed25519",
     "x": "..."
   }

2. Creating LCE message...
✓ LCE created

3. Signing LCE with Ed25519...
✓ LCE signed
  Signature: eyJhbGciOiJFZERTQSIsInR5cCI6IkxDRSJ9.eyJsY2UiOiJ7XCJpbnRlbnRcIjp7XCJ0eXBlX...

4. Inspecting signature...
✓ Signature structure:
  Header:
    alg: EdDSA
    typ: LCE

5. Verifying signature...
✓ Signature valid: true

6. Testing tampered message detection...
✓ Tampered message valid: false (should be false)

7. Testing wrong key detection...
✓ Wrong key valid: false (should be false)
```

## Использование в коде

### Генерация ключей

```javascript
const { ltp } = require('node-lri');

const keys = await ltp.generateKeys();
// Сохраните privateKey в секретном месте
// Публикуйте publicKeyJWK для проверки
```

### Подписание LCE

```javascript
const lce = {
  v: 1,
  intent: { type: 'tell' },
  policy: { consent: 'private' },
};

const signed = await ltp.sign(lce, keys.privateKey, {
  iss: 'my-service',  // Опционально: issuer
  sub: 'user-123',     // Опционально: subject
});

console.log(signed.sig); // JWS подпись
```

### Верификация

```javascript
const valid = await ltp.verify(signed, keys.publicKey, {
  issuer: 'my-service',  // Опционально: проверка issuer
});

if (valid) {
  console.log('Подпись валидна!');
} else {
  console.log('Подпись невалидна или сообщение изменено!');
}
```

### Инспекция подписи

```javascript
const info = ltp.inspectSignature(signed.sig);

console.log('Алгоритм:', info.header.alg);  // EdDSA
console.log('Issuer:', info.payload.iss);    // my-service
console.log('Issued at:', new Date(info.payload.iat * 1000));
```

## Интеграция

### WebSocket (автоматически)

```javascript
const keys = await ltp.generateKeys();

const server = new ws.LRIWSServer({
  port: 8080,
  ltp: true,                        // Включить LTP
  ltpPrivateKey: keys.privateKey,   // Ваш приватный ключ
});

// Seal сообщения будут автоматически подписаны
```

### HTTP (вручную)

```javascript
app.post('/api/message', async (req, res) => {
  const lce = req.lri;  // Из middleware

  // Подпись LCE
  const signed = await ltp.sign(lce, privateKey);

  // Отправка с подписью
  res.setHeader('X-LRI-Context', Buffer.from(JSON.stringify(signed)).toString('base64'));
  res.json({ status: 'ok' });
});
```

## Управление ключами

### Генерация и сохранение

```javascript
const keys = await ltp.generateKeys();

// Сохраните JWK для повторного использования
const fs = require('fs');
fs.writeFileSync('public-key.json', JSON.stringify(keys.publicKeyJWK, null, 2));

// ⚠️ ВАЖНО: privateKey держите в секрете!
// Используйте переменные окружения или менеджер секретов
```

### Загрузка ключей

```javascript
const publicKeyJWK = JSON.parse(fs.readFileSync('public-key.json'));
const privateKeyJWK = JSON.parse(process.env.LTP_PRIVATE_KEY);

const keys = await ltp.importKeys(privateKeyJWK, publicKeyJWK);
```

## Безопасность

✅ **Рекомендуется:**
- Используйте переменные окружения для приватных ключей
- Ротация ключей каждые 90 дней (используйте `kid` в опциях)
- Публикуйте публичные ключи через HTTPS
- Проверяйте `iss` (issuer) при верификации

❌ **Не делайте:**
- Не коммитьте приватные ключи в git
- Не передавайте приватные ключи по незащищенным каналам
- Не используйте один ключ для всех сервисов

## Производительность

- Генерация ключей: ~2-5 ms
- Подписание: ~1-3 ms
- Верификация: ~2-4 ms

Ed25519 очень быстрый и подходит для real-time приложений.

## След