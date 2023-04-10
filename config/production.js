module.exports = {
    mongoURI: process.env.MONGO_URI,
    docspringId: process.env.DOCSPRING_ID,
    docspringSecret: process.env.DOCSPRING_SECRET,
    pier_admin_key: process.env.PIER_ADMIN_KEY,
    docspringTest: false,
    envo: "production",
    allow_sandbox_testing_endpoints: false,
    logLevel: "info",
    nls_username: process.env.NLS_USERNAME,
    nls_password: process.env.NLS_PASSWORD,
    nls_client_id: process.env.NLS_CLIENT_ID,
    nls_secret: process.env.NLS_SECRET,
    nls_scope: process.env.NLS_SCOPE,
    slack_bot_id: process.env.SLACK_BOT_ID,
    aes_secret_key: process.env.AES_SECRET_KEY,
    aes_iv: process.env.AES_IV
}