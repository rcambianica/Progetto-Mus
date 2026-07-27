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

    /*
     * In locale usa il parallelismo normale.
     * In CI un worker solo rende più stabili
     * soprattutto i test Web Audio.
     */
    workers:
        process.env.CI
            ? 1
            : undefined,

    retries:
        process.env.CI
            ? 1
            : 0,

    reporter: [
        ["list"],
        [
            "html",
            {
                open: "never"
            }
        ]
    ],

    use: {
        baseURL:
            "http://127.0.0.1:8000",

        trace:
            "on-first-retry"
    },

    projects: [
        {
            name: "chromium",

            use: {
                ...devices[
                    "Desktop Chrome"
                ]
            }
        },

        {
            name: "firefox",

            use: {
                ...devices[
                    "Desktop Firefox"
                ]
            }
        },

        {
            name: "webkit",

            use: {
                ...devices[
                    "Desktop Safari"
                ]
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