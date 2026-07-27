const {
    defineConfig,
    devices
} = require("@playwright/test");

module.exports = defineConfig({
    testDir: "./tests",

    timeout: 30_000,

    expect: {
        timeout: 5_000
    },

    use: {
        baseURL: "http://127.0.0.1:8000",
        trace: "on-first-retry"
    },

    projects: [
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"]
            }
        }
    ],

    webServer: {
        command:
            "python3 -m http.server 8000 --bind 127.0.0.1",

        url:
            "http://127.0.0.1:8000",

        reuseExistingServer: true
    }
});