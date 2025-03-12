/**
 * @name Send Spotify Song
 * @version 2.13.3
 * @description A BetterDiscord plugin that can easily grab songs and send previews to the channel you are in.
 * 
 */
module.exports = class SendSpotifySong {
    constructor() {
        this._config = {
            info: {
                name: "SendSpotifySong",
                version: "2.13.3",
                description: "Easily grab songs and send previews via embeds."
            }
        };
        this.defaultSettings = {
            client_id: "",
            client_secret: "",
            maxResults: 10,
            debounceTime: 0.3,
            hideMessage: false,
            autoSearch: true
        };
        this.settings = Object.assign(
            {},
            this.defaultSettings,
            BdApi.Data.load(this._config.info.name, "settings")
        );
        this.buttonId = "send-spotify-song-button";
        this.checkInterval = null;
    }

    load() {}

    start() {
        BdApi.injectCSS("SendSpotifySong_Styles", `
            * {
                -ms-overflow-style: none;
                scrollbar-width: none;
            }
            *::-webkit-scrollbar {
                width: 0 !important;
                display: none !important;
            }
        `);
        this.insertButton();
        this.checkInterval = setInterval(() => {
            if (!document.getElementById(this.buttonId)) {
                this.insertButton();
            }
        }, 1000);
    }

    stop() {
        this.removeButton();
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        BdApi.clearCSS("SendSpotifySong_Styles");
    }

    insertButton() {
        const container = document.querySelector("form [class*=channelTextArea] [class*=buttons]");
        if (container && !document.getElementById(this.buttonId)) {
            const button = document.createElement("button");
            button.id = this.buttonId;
            button.innerHTML = `
                <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor">
                    <path d="M9 3v10.55A4 4 0 1 0 11 17V7h4V3H9z"/>
                </svg>
            `;
            button.style.width = "32px";
            button.style.height = "32px";
            button.style.boxSizing = "border-box";
            button.style.padding = "4px";
            button.style.display = "inline-flex";
            button.style.alignItems = "center";
            button.style.justifyContent = "center";
            button.style.marginRight = "8px";
            button.style.backgroundColor = "transparent";
            button.style.border = "none";
            button.style.cursor = "pointer";
            button.style.color = "var(--text-muted)";
            button.style.position = "relative";
            button.style.top = "6px";
            button.addEventListener("mouseenter", () => {
                button.style.color = "var(--text-normal)";
            });
            button.addEventListener("mouseleave", () => {
                button.style.color = "var(--text-muted)";
            });
            button.addEventListener("click", () => {
                this.showModal();
            });
            container.appendChild(button);
        }
    }

    removeButton() {
        const button = document.getElementById(this.buttonId);
        if (button) button.remove();
    }

    saveSettings() {
        BdApi.Data.save(this._config.info.name, "settings", this.settings);
    }

    async getAccessToken() {
        const tokenUrl = "https://accounts.spotify.com/api/token";
        const credentials = btoa(`${this.settings.client_id}:${this.settings.client_secret}`);
        if (!this.settings.client_id || !this.settings.client_secret) {
            BdApi.UI.showToast("Spotify client_id or client_secret not set.", { type: "error" });
            return null;
        }
        try {
            const response = await fetch(tokenUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": "Basic " + credentials
                },
                body: "grant_type=client_credentials"
            });
            if (!response.ok) return null;
            const data = await response.json();
            return data.access_token;
        } catch {
            return null;
        }
    }

    async searchSpotifyMultiple(query) {
        if (!query) return [];
        const accessToken = await this.getAccessToken();
        if (!accessToken) {
            BdApi.UI.showToast("Failed to retrieve Spotify token.", { type: "error" });
            return [];
        }
        const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${this.settings.maxResults}`;
        try {
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!response.ok) {
                BdApi.UI.showToast(`Spotify request failed: ${response.status} ${response.statusText}`, { type: "error" });
                return [];
            }
            const data = await response.json();
            return data?.tracks?.items || [];
        } catch {
            BdApi.UI.showToast("Error during Spotify search.", { type: "error" });
            return [];
        }
    }

    formatLink(spotifyUrl) {
        if (!this.settings.hideMessage) return spotifyUrl;
        const bars =
            "||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||";
        return bars + spotifyUrl;
    }

    insertTrackIntoTextBox(spotifyUrl) {
        const textToInsert = this.formatLink(spotifyUrl);
        const textArea = document.querySelector("div[role='textbox']");
        if (textArea) {
            const inputEvent = new InputEvent("beforeinput", {
                bubbles: true,
                cancelable: true,
                data: textToInsert,
                inputType: "insertText"
            });
            textArea.dispatchEvent(inputEvent);
            textArea.focus();
            document.execCommand("insertText", false, textToInsert);
            BdApi.UI.showToast("Track link inserted.", { type: "success" });
        } else {
            BdApi.UI.showToast("Message input box not found.", { type: "error" });
        }
    }

    showModal() {
        const React = BdApi.React;
        BdApi.UI.showConfirmationModal(
            "Spotify Track Search",
            React.createElement(() => {
                const [results, setResults] = React.useState([]);
                const [query, setQuery] = React.useState("");
                const debounceRef = React.useRef(null);

                const doSearch = async (searchTerm) => {
                    if (!searchTerm.trim()) {
                        setResults([]);
                        return;
                    }
                    const tracks = await this.searchSpotifyMultiple(searchTerm);
                    setResults(tracks);
                };

                const handleInputChange = (e) => {
                    const newValue = e.target.value;
                    setQuery(newValue);
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    if (this.settings.autoSearch) {
                        debounceRef.current = setTimeout(() => {
                            doSearch(newValue.trim());
                        }, this.settings.debounceTime * 1000);
                    }
                };

                const handleItemClick = (track) => {
                    this.insertTrackIntoTextBox(track.external_urls.spotify);
                    BdApi.UI.hideConfirmationModal();
                };

                const handleManualSearch = () => {
                    doSearch(query.trim());
                };

                return React.createElement(
                    "div",
                    { style: { display: "flex", flexDirection: "column", color: "var(--text-normal)" } },
                    React.createElement(
                        "label",
                        {
                            htmlFor: "spotifyModalInput",
                            style: { marginBottom: "4px", marginLeft: "4px", fontSize: "14px", fontWeight: "500", color: "var(--header-secondary)" }
                        },
                        "Enter a track name:"
                    ),
                    React.createElement("input", {
                        type: "text",
                        placeholder: "e.g. 'N95' by Kendrick Lamar",
                        id: "spotifyModalInput",
                        autoFocus: true,
                        style: {
                            width: "100%",
                            padding: "8px",
                            borderRadius: "4px",
                            backgroundColor: "var(--background-tertiary)",
                            color: "var(--text-normal)",
                            fontSize: "14px",
                            border: "1px solid var(--background-modifier-accent)",
                            outline: "none",
                            marginBottom: "8px"
                        },
                        value: query,
                        onChange: handleInputChange
                    }),
                    !this.settings.autoSearch &&
                        React.createElement(
                            "button",
                            {
                                onClick: handleManualSearch,
                                style: {
                                    padding: "6px 8px",
                                    marginBottom: "8px",
                                    backgroundColor: "var(--button-secondary-background)",
                                    color: "var(--text-normal)",
                                    border: "1px solid var(--background-modifier-accent)",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "14px"
                                }
                            },
                            "Search"
                        ),
                    results.length > 0 &&
                        React.createElement(
                            "div",
                            {
                                className: "simpleSpotifyScroll",
                                style: {
                                    maxHeight: "200px",
                                    overflowY: "auto",
                                    border: "none",
                                    width: "103.5%",
                                    borderRadius: "0",
                                    marginLeft: "2px"
                                }
                            },
                            results.map((track) => {
                                const imageUrl = track.album?.images?.[0]?.url || "";
                                return React.createElement(
                                    "div",
                                    {
                                        key: track.id,
                                        onClick: () => handleItemClick(track),
                                        style: {
                                            position: "relative",
                                            height: "64px",
                                            cursor: "pointer",
                                            borderRadius: "4px",
                                            marginBottom: "8px",
                                            backgroundImage: imageUrl ? `url(${imageUrl})` : "none",
                                            backgroundSize: "cover",
                                            backgroundPosition: "center"
                                        }
                                    },
                                    React.createElement("div", {
                                        style: {
                                            position: "absolute",
                                            inset: 0,
                                            backgroundColor: "rgba(0, 0, 0, 0.4)",
                                            borderRadius: "4px"
                                        }
                                    }),
                                    React.createElement(
                                        "div",
                                        {
                                            style: {
                                                position: "relative",
                                                zIndex: 1,
                                                display: "flex",
                                                alignItems: "center",
                                                height: "100%",
                                                padding: "0 8px",
                                                color: "#fff",
                                                fontSize: "14px",
                                                textShadow: "0 0 2px black"
                                            }
                                        },
                                        `${track.name} – ${track.artists.map(a => a.name).join(", ")}`
                                    )
                                );
                            })
                        )
                );
            }, this),
            { cancelText: "Cancel" }
        );
    }

    getSettingsPanel() {
        return BdApi.UI.buildSettingsPanel({
            settings: [
                {
                    type: "switch",
                    id: "autoSearch",
                    name: "Auto Search",
                    note: "Automatically search when typing stops (true by default).",
                    value: this.settings.autoSearch
                },
                {
                    type: "number",
                    id: "debounceTime",
                    name: "Debounce Time (seconds)",
                    note: "Time to wait (in seconds) before auto-search triggers (0.3 by default).",
                    value: this.settings.debounceTime,
                    step: 0.1
                },
                {
                    type: "number",
                    id: "maxResults",
                    name: "Max Results",
                    note: "Number of tracks to show in search results (10 by default).",
                    value: this.settings.maxResults
                },
                {
                    type: "switch",
                    id: "hideMessage",
                    name: "Hide Message",
                    note: "If enabled, the link is sent with hidden message bars.",
                    value: this.settings.hideMessage
                },
                {
                    type: "text",
                    id: "client_id",
                    name: "Spotify Client ID",
                    note: "Enter your Spotify Client ID.",
                    value: this.settings.client_id
                },
                {
                    type: "text",
                    id: "client_secret",
                    name: "Spotify Client Secret",
                    note: "Enter your Spotify Client Secret.",
                    value: this.settings.client_secret
                }
            ],
            onChange: (category, id, value) => {
                this.settings[id] = value;
                this.saveSettings();
            }
        });
    }
};
