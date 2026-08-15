# Email

Order email is server-only. `services/api/src/email.ts` exposes an `EmailProvider` boundary and currently implements SMTP with Nodemailer. In development, missing SMTP variables select a safe no-send provider and log only the order number. In production, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SHOP_EMAIL`, `SHOP_PHONE`, `SHOP_WEBSITE` and `ADMIN_EMAIL`.

Customer email contains order number, date, products, color, base, quantity, price, total and shop contact. Admin email additionally includes address, phone and note.
