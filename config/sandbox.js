module.exports = {
    mongoURI: process.env.MONGO_URI,
    docspringId: process.env.DOCSPRING_ID,
    docspringSecret: process.env.DOCSPRING_SECRET,
    pier_admin_key: process.env.PIER_ADMIN_KEY,
    docspringTest: true,
    envo: "sandbox",
    allow_sandbox_testing_endpoints: true,
    logLevel: "info",
    nls_username: process.env.NLS_USERNAME,
    nls_password: process.env.NLS_PASSWORD,
    nls_client_id: process.env.NLS_CLIENT_ID,
    nls_secret: process.env.NLS_SECRET,
    nls_scope: process.env.NLS_SCOPE
    /*
    nls_username: "PLREST8876",
    nls_password: "prV%h6e@q",
    nls_client_id: "08876T",
    nls_secret: "x7DbV!qa^",
    nls_scope: "openid api server:rnn1-nls-sqlt04.nls.nortridge.tech db:Pier_Lending_Test"
    */
}