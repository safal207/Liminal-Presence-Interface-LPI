# LTP Signing Example

Демонстрация **LTP (Liminal Trust Protocol)** — канонизации JCS и подписей Ed25519 для LCE сообщений.

## Что такое LTP?

LTP обеспечивает:
- **Аутентификацию** — подтверждение отправителя
- **Целостность** — обнаружение изменений
- **Неотказуемость** — невозможность отрицать отправку

## Технологии

- **Ed25519** — современная криптография с эллиптическими кривыми
- **JCS** — JSON Canonicalization Scheme (RFC 8785)

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
  Signature (base64url): nFpCWblIWi-WUYFkv5867jIaHjQ2dOL1f5EPRuOZjD4plUpGVeTcIh...

4. Verifying signature...
✓ Signature valid: true

5. Testing tampered message detection...
✓ Tampered message valid: false (should be false)

6. Testing wrong key detection...
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

const signed = await ltp.sign(lce, keys.privateKey);

console.log(signed.sig); // Base64url-подпись Ed25519
```

### Верификация

```javascript
const valid = await ltp.verify(signed, keys.publicKey);

if (valid) {
  console.log('Подпись валидна!');
} else {
  console.log('Подпись невалидна или сообщение изменено!');
}
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
const jwk = JSON.parse(process.env.LTP_PRIVATE_KEY_JSON);
const keys = ltp.importKeys(jwk);
```

## Безопасность

✅ **Рекомендуется:**
- Используйте переменные окружения для приватных ключей
- Ротация ключей каждые 90 дней (используйте `kid` в метаданных транспорта)
- Публикуйте публичные ключи через HTTPS
- Проверяйте временные метки в сообщении (`iat`, `exp` и т.д.)

❌ **Не делайте:**
- Не коммитьте приватные ключи в git
- Не передавайте приватные ключи по незащищенным каналам
- Не используйте один ключ для всех сервисов

## Производительность

- Генерация ключей: ~2-5 ms
- Подписание: ~1-3 ms
- Верификация: ~2-4 ms

Ed25519 очень быстрый и подходит для real-time приложений.
