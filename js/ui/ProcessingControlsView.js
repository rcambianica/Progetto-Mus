import {
    state,
    updateProcessingSettings
} from "../state.js";

const MODULE_DEFINITIONS = [
    {
        section: "eq",
        enabledId: "eqEnabled",
        controls: [
            numericControl(
                "eqLowGain",
                "lowGain",
                "eqLowGainValue",
                formatSignedDb
            ),
            numericControl(
                "eqMidGain",
                "midGain",
                "eqMidGainValue",
                formatSignedDb
            ),
            numericControl(
                "eqHighGain",
                "highGain",
                "eqHighGainValue",
                formatSignedDb
            )
        ]
    },
    {
        section: "compressor",
        enabledId: "compressorEnabled",
        controls: [
            numericControl(
                "compressorThreshold",
                "threshold",
                "compressorThresholdValue",
                value => `${value.toFixed(0)} dB`
            ),
            numericControl(
                "compressorRatio",
                "ratio",
                "compressorRatioValue",
                value => `${value.toFixed(1)}:1`
            ),
            numericControl(
                "compressorAttack",
                "attack",
                "compressorAttackValue",
                value => `${value.toFixed(3)} s`
            ),
            numericControl(
                "compressorRelease",
                "release",
                "compressorReleaseValue",
                value => `${value.toFixed(3)} s`
            )
        ]
    },
    {
        section: "distortion",
        enabledId: "distortionEnabled",
        controls: [
            numericControl(
                "distortionDrive",
                "drive",
                "distortionDriveValue",
                value => `${Math.round(value)}%`
            ),
            numericControl(
                "distortionMix",
                "mix",
                "distortionMixValue",
                formatPercentage
            ),
            selectControl(
                "distortionOversample",
                "oversample"
            )
        ]
    },
    {
        section: "chorus",
        enabledId: "chorusEnabled",
        controls: [
            numericControl(
                "chorusRate",
                "rate",
                "chorusRateValue",
                value => `${value.toFixed(2)} Hz`
            ),
            numericControl(
                "chorusDepth",
                "depthMs",
                "chorusDepthValue",
                value => `${value.toFixed(1)} ms`
            ),
            numericControl(
                "chorusMix",
                "mix",
                "chorusMixValue",
                formatPercentage
            )
        ]
    },
    {
        section: "delay",
        enabledId: "delayEnabled",
        controls: [
            numericControl(
                "delayTime",
                "time",
                "delayTimeValue",
                value => `${value.toFixed(3)} s`
            ),
            numericControl(
                "delayFeedback",
                "feedback",
                "delayFeedbackValue",
                formatPercentage
            ),
            numericControl(
                "delayMix",
                "mix",
                "delayMixValue",
                formatPercentage
            )
        ]
    },
    {
        section: "reverb",
        enabledId: "reverbEnabled",
        controls: [
            numericControl(
                "reverbDuration",
                "duration",
                "reverbDurationValue",
                value => `${value.toFixed(2)} s`
            ),
            numericControl(
                "reverbDecay",
                "decay",
                "reverbDecayValue",
                value => value.toFixed(1)
            ),
            numericControl(
                "reverbMix",
                "mix",
                "reverbMixValue",
                formatPercentage
            )
        ]
    },
    {
        section: "normalization",
        enabledId: "normalizationEnabled",
        controls: [
            selectControl(
                "normalizationTarget",
                "targetDb",
                "normalizationTargetValue",
                value => `${value.toFixed(2)} dBFS`,
                Number
            )
        ]
    },
    {
        section: "limiter",
        enabledId: "limiterEnabled",
        controls: [
            numericControl(
                "limiterThreshold",
                "threshold",
                "limiterThresholdValue",
                value => `${value.toFixed(1)} dBFS`
            )
        ]
    }
];

export class ProcessingControlsView {
    constructor({
        onSettingsChanged
    }) {
        this.onSettingsChanged =
            onSettingsChanged;
    }

    bind() {
        this.bindGainControl();

        for (
            const definition
            of MODULE_DEFINITIONS
        ) {
            this.bindModule(definition);
        }

        this.bindModuleCards();
    }

    render() {
        this.renderGainControl();

        for (
            const definition
            of MODULE_DEFINITIONS
        ) {
            this.renderModule(definition);
        }

        this.renderModuleCards();
    }

    bindGainControl() {
        const gainSlider =
            document.getElementById(
                "gainSlider"
            );

        gainSlider.addEventListener(
            "input",
            () => {
                updateProcessingSettings(
                    "gain",
                    {
                        enabled: true,
                        value:
                            Number(
                                gainSlider.value
                            )
                    }
                );

                this.renderGainControl();
                this.onSettingsChanged();
            }
        );
    }

    bindModule(definition) {
        const enabledElement =
            document.getElementById(
                definition.enabledId
            );

        enabledElement.addEventListener(
            "change",
            () => {
                updateProcessingSettings(
                    definition.section,
                    {
                        enabled:
                            enabledElement.checked
                    }
                );

                this.renderModule(
                    definition
                );

                this.onSettingsChanged();
            }
        );

        for (
            const control
            of definition.controls
        ) {
            const element =
                document.getElementById(
                    control.id
                );

            element.addEventListener(
                control.eventName,
                () => {
                    updateProcessingSettings(
                        definition.section,
                        {
                            [control.settingName]:
                                control.parse(
                                    element.value
                                )
                        }
                    );

                    this.renderModule(
                        definition
                    );

                    this.onSettingsChanged();
                }
            );
        }
    }

    bindModuleCards() {
        const modules =
            document.querySelectorAll(
                "[data-toggle-input]"
            );

        for (const moduleElement of modules) {
            const inputElement =
                document.getElementById(
                    moduleElement.dataset
                        .toggleInput
                );

            if (!inputElement) {
                console.warn(
                    `Processing toggle not found: ${moduleElement.dataset.toggleInput}`
                );
                continue;
            }

            moduleElement.addEventListener(
                "click",
                event => {
                    if (
                        isInteractiveTarget(
                            event.target
                        )
                    ) {
                        return;
                    }

                    toggleInput(inputElement);
                }
            );

            moduleElement.addEventListener(
                "keydown",
                event => {
                    if (
                        event.target !==
                            moduleElement ||
                        ![
                            "Enter",
                            " "
                        ].includes(event.key)
                    ) {
                        return;
                    }

                    event.preventDefault();
                    toggleInput(inputElement);
                }
            );
        }
    }

    renderGainControl() {
        const gainSlider =
            document.getElementById(
                "gainSlider"
            );

        const gainValueElement =
            document.getElementById(
                "gainValue"
            );

        const gainValue =
            state.processingSettings
                .gain.value;

        if (
            Number(gainSlider.value) !==
            gainValue
        ) {
            gainSlider.value =
                String(gainValue);
        }

        gainValueElement.textContent =
            gainValue.toFixed(2);
    }

    renderModule(definition) {
        const settings =
            state.processingSettings[
                definition.section
            ];

        const enabledElement =
            document.getElementById(
                definition.enabledId
            );

        enabledElement.checked =
            settings.enabled;

        for (
            const control
            of definition.controls
        ) {
            const element =
                document.getElementById(
                    control.id
                );

            const value =
                settings[
                    control.settingName
                ];

            element.disabled =
                !settings.enabled;

            element.value =
                String(value);

            if (!control.valueId) {
                continue;
            }

            const valueElement =
                document.getElementById(
                    control.valueId
                );

            valueElement.textContent =
                control.format(value);
        }
    }

    renderModuleCards() {
        const modules =
            document.querySelectorAll(
                "[data-toggle-input]"
            );

        for (const moduleElement of modules) {
            const inputElement =
                document.getElementById(
                    moduleElement.dataset
                        .toggleInput
                );

            if (!inputElement) {
                continue;
            }

            const enabled =
                inputElement.checked;

            moduleElement.classList.toggle(
                "is-enabled",
                enabled
            );

            const statusElement =
                moduleElement.querySelector(
                    "[data-module-status]"
                );

            if (statusElement) {
                statusElement.textContent =
                    enabled ? "On" : "Off";
            }
        }
    }
}

function numericControl(
    id,
    settingName,
    valueId,
    format
) {
    return {
        id,
        settingName,
        valueId,
        format,
        eventName: "input",
        parse: Number
    };
}

function selectControl(
    id,
    settingName,
    valueId = null,
    format = String,
    parse = value => value
) {
    return {
        id,
        settingName,
        valueId,
        format,
        eventName: "change",
        parse
    };
}

function toggleInput(inputElement) {
    inputElement.checked =
        !inputElement.checked;

    inputElement.dispatchEvent(
        new Event(
            "change",
            {
                bubbles: true
            }
        )
    );
}

function isInteractiveTarget(target) {
    return Boolean(
        target.closest(
            "input, select, button, a, label, [data-knob-for]"
        )
    );
}

function formatSignedDb(value) {
    const prefix =
        value > 0 ? "+" : "";

    return `${prefix}${value.toFixed(1)} dB`;
}

function formatPercentage(value) {
    return `${Math.round(value * 100)}%`;
}