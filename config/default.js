module.exports = {
    mongoURI: process.env.MONGO_URI,
    logLevel: "debug",
    docspringId: process.env.DOCSPRING_ID,
    docspringSecret: process.env.DOCSPRING_SECRET,
    pier_admin_key: process.env.PIER_ADMIN_KEY,
    docspringTest: true,
    allow_sandbox_testing_endpoints: true,
    envo: "default",
    logLevel: "debug",
    nls_username: process.env.NLS_USERNAME,
    nls_password: process.env.NLS_PASSWORD,
    nls_client_id: process.env.NLS_CLIENT_ID,
    nls_secret: process.env.NLS_SECRET,
    nls_scope: process.env.NLS_SCOPE,
    slack_bot_id: process.env.SLACK_BOT_ID,
    aes_secret_key: process.env.AES_SECRET_KEY,
    aes_iv: process.env.AES_IV,
    current_date: "05/18/2023", // for testing only
    date_format_pier: "YYYY-MM-DD",
    dwolla: {
        client_id: process.env.DWOLLA_CLIENT_ID,
        client_secret: process.env.DWOLLA_CLIENT_SECRET,
        pier_funding_source_id: process.env.PIER_DWOLLA_FUNDING_SOURCE_ID
    },
    crs: {
        client_id: process.env.CRS_CLIENT_ID,
        secret: process.env.CRS_SECRET
    }
}
