/**
 * @name Send Spotify Song
 * @version 2.14.0
 * @source https://github.com/itsTurdle/betterdiscordplugins
 * @description A BetterDiscord plugin that can easily grab songs and send previews to the channel you are in.
 * @author its_turdle
 */
module.exports = class SendSpotifySong {
    constructor() {
        this._config = {
            info: {
                name: "SendSpotifySong",
                version: "2.14.0",
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
        this.settings = Object.assign({}, this.defaultSettings, BdApi.Data.load(this._config.info.name, "settings"));
        this.buttonId = "send-spotify-song-button";
        this.checkInterval = null;
        this.cachedToken = null;
        this.MASK_STRING = "*||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||||||||||*";
    }

    load() {}

    start() {
        this.patchSend();
        this.insertButton();
        this.preloadToken();
        this.checkInterval = setInterval(() => {
            if (!document.getElementById(this.buttonId)) {
                this.insertButton();
            }
        }, 1000);
    }

    async preloadToken() {
        if (this.settings.client_id && this.settings.client_secret) {
            this.cachedToken = await this.getAccessToken();
            setTimeout(() => this.preloadToken(), 3500 * 1000);
        }
    }

    stop() {
        this.removeButton();
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        BdApi.Patcher.unpatchAll("SendSpotifySong");
    }

    patchSend() {
        const MessageActions = BdApi.Webpack.getModule(m => m?.sendMessage && m?.receiveMessage);
        if (MessageActions) {
            BdApi.Patcher.before("SendSpotifySong", MessageActions, "sendMessage", (_, args) => {
                if (args[1]?.content?.includes("<mask>")) {
                    args[1].content = args[1].content.replace(/<mask>/g, this.MASK_STRING);
                }
            });
        }
    }

    insertButton() {
        const container = document.querySelector("form [class*=channelTextArea] [class*=buttons]");
        if (container && !document.getElementById(this.buttonId)) {
            const existingButton = container.querySelector("[class*=buttonContainer]");
            const innerButton = existingButton?.querySelector("[class*=button_]");
            
            const wrapper = document.createElement("div");
            wrapper.id = this.buttonId;
            wrapper.className = existingButton?.className || "";
            
            const button = document.createElement("div");
            button.className = innerButton?.className || "";
            button.setAttribute("role", "button");
            button.setAttribute("tabindex", "0");
            button.style.cursor = "pointer";
            
            const iconWrapper = document.createElement("div");
            iconWrapper.className = innerButton?.firstElementChild?.className || "";
            iconWrapper.style.cssText = "display: flex; width: 24px; height: 24px; align-items: center; justify-content: center;";
            iconWrapper.innerHTML = `
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" 
                     style="color: var(--interactive-normal); transition: color 0.15s ease;">
                    <path d="M9 3v10.55A4 4 0 1 0 11 17V7h4V3H9z"/>
                </svg>
            `;
            
            button.appendChild(iconWrapper);
            wrapper.appendChild(button);
            
            wrapper.addEventListener("mouseenter", () => {
                iconWrapper.querySelector("svg").style.color = "var(--interactive-hover)";
            });
            wrapper.addEventListener("mouseleave", () => {
                iconWrapper.querySelector("svg").style.color = "var(--interactive-normal)";
            });
            wrapper.addEventListener("click", () => this.showModal());
            
            container.appendChild(wrapper);
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
        if (!this.settings.client_id || !this.settings.client_secret) {
            BdApi.UI.showToast("Spotify client_id or client_secret not set.", { type: "error" });
            return null;
        }
        try {
            const response = await fetch("https://accounts.spotify.com/api/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": "Basic " + btoa(`${this.settings.client_id}:${this.settings.client_secret}`)
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
        let accessToken = this.cachedToken;
        if (!accessToken) {
            accessToken = await this.getAccessToken();
            this.cachedToken = accessToken;
        }
        if (!accessToken) {
            BdApi.UI.showToast("Failed to retrieve Spotify token.", { type: "error" });
            return [];
        }
        try {
            const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${this.settings.maxResults}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (response.status === 401) {
                this.cachedToken = null;
                accessToken = await this.getAccessToken();
                this.cachedToken = accessToken;
                if (!accessToken) {
                    BdApi.UI.showToast("Token expired, retry.", { type: "error" });
                    return [];
                }
                const retry = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${this.settings.maxResults}`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (!retry.ok) return [];
                const data = await retry.json();
                return data?.tracks?.items || [];
            }
            if (!response.ok) {
                BdApi.UI.showToast(`Spotify request failed: ${response.status}`, { type: "error" });
                return [];
            }
            const data = await response.json();
            return data?.tracks?.items || [];
        } catch {
            BdApi.UI.showToast("Error during Spotify search.", { type: "error" });
            return [];
        }
    }

    hasMaskInTextbox() {
        const textArea = document.querySelector("div[role='textbox']");
        const content = textArea?.textContent || "";
        return content.includes("*||") || content.includes("<mask>");
    }

    insertTrackIntoTextBox(spotifyUrl) {
        let textToInsert = spotifyUrl;
        if (this.settings.hideMessage && !this.hasMaskInTextbox()) {
            textToInsert = "<mask>" + spotifyUrl;
        }
        
        const textArea = document.querySelector("div[role='textbox']");
        if (!textArea) {
            BdApi.UI.showToast("Message input not found.", { type: "error" });
            return;
        }
        
        textArea.focus();
        
        const dt = new DataTransfer();
        dt.setData("text/plain", textToInsert);
        const pasteEvent = new ClipboardEvent("paste", {
            clipboardData: dt,
            bubbles: true,
            cancelable: true
        });
        textArea.dispatchEvent(pasteEvent);
        BdApi.UI.showToast("Track link inserted.", { type: "success" });
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
                    if (!searchTerm.trim()) { setResults([]); return; }
                    const tracks = await this.searchSpotifyMultiple(searchTerm);
                    setResults(tracks);
                };

                const handleInputChange = (e) => {
                    const newValue = e.target.value;
                    setQuery(newValue);
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    if (this.settings.autoSearch) {
                        debounceRef.current = setTimeout(() => doSearch(newValue.trim()), this.settings.debounceTime * 1000);
                    }
                };

                const handleItemClick = (track) => {
                    this.insertTrackIntoTextBox(track.external_urls.spotify);
                    document.querySelector("[class*=backdrop]")?.click();
                };

                return React.createElement("div", { style: { display: "flex", flexDirection: "column", color: "var(--text-normal)" } },
                    React.createElement("label", {
                        htmlFor: "spotifyModalInput",
                        style: { marginBottom: "4px", marginLeft: "4px", fontSize: "14px", fontWeight: "500", color: "var(--header-secondary)" }
                    }, "Enter a track name:"),
                    React.createElement("input", {
                        type: "text",
                        placeholder: "e.g. 'N95' by Kendrick Lamar",
                        id: "spotifyModalInput",
                        autoFocus: true,
                        style: {
                            width: "100%", padding: "8px", borderRadius: "4px",
                            backgroundColor: "var(--background-tertiary)", color: "var(--text-normal)",
                            fontSize: "14px", border: "1px solid var(--background-modifier-accent)",
                            outline: "none", marginBottom: "8px"
                        },
                        value: query,
                        onChange: handleInputChange
                    }),
                    !this.settings.autoSearch && React.createElement("button", {
                        onClick: () => doSearch(query.trim()),
                        style: {
                            padding: "6px 8px", marginLeft: "2px", width: "103.5%", marginBottom: "8px",
                            backgroundColor: "var(--button-secondary-background)", color: "var(--text-normal)",
                            border: "1px solid var(--background-modifier-accent)", borderRadius: "4px",
                            cursor: "pointer", fontSize: "14px"
                        }
                    }, "Search"),
                    results.length > 0 && React.createElement("div", {
                        style: { maxHeight: "200px", overflowY: "auto", border: "none", width: "103.5%", borderRadius: "0", marginLeft: "2px" }
                    }, results.map((track) => {
                        const imageUrl = track.album?.images?.[0]?.url || "";
                        return React.createElement("div", {
                            key: track.id,
                            onClick: () => handleItemClick(track),
                            style: {
                                position: "relative", height: "64px", cursor: "pointer",
                                borderRadius: "4px", marginBottom: "8px",
                                backgroundImage: imageUrl ? `url(${imageUrl})` : "none",
                                backgroundSize: "cover", backgroundPosition: "center"
                            }
                        },
                            React.createElement("div", {
                                style: { position: "absolute", inset: 0, backgroundColor: "rgba(0, 0, 0, 0.4)", borderRadius: "4px" }
                            }),
                            React.createElement("div", {
                                style: {
                                    position: "relative", zIndex: 1, display: "flex", alignItems: "center",
                                    height: "100%", padding: "0 8px", color: "#fff", fontSize: "14px", textShadow: "0 0 2px black"
                                }
                            }, `${track.name} — ${track.artists.map(a => a.name).join(", ")}`)
                        );
                    }))
                );
            }, this),
            { cancelText: "Cancel" }
        );
    }

    getSettingsPanel() {
        return BdApi.UI.buildSettingsPanel({
            settings: [
                { type: "switch", id: "autoSearch", name: "Auto Search", note: "Automatically search when typing stops.", value: this.settings.autoSearch },
                { type: "number", id: "debounceTime", name: "Debounce Time (seconds)", note: "Time to wait before auto-search.", value: this.settings.debounceTime, step: 0.1 },
                { type: "number", id: "maxResults", name: "Max Results", note: "Number of tracks to show.", value: this.settings.maxResults },
                { type: "switch", id: "hideMessage", name: "Hide Message", note: "Prepend <mask> to hide your message text.", value: this.settings.hideMessage },
                { type: "text", id: "client_id", name: "Spotify Client ID", note: "Enter your Spotify Client ID.", value: this.settings.client_id },
                { type: "text", id: "client_secret", name: "Spotify Client Secret", note: "Enter your Spotify Client Secret.", value: this.settings.client_secret }
            ],
            onChange: (category, id, value) => {
                this.settings[id] = value;
                this.saveSettings();
            }
        });
    }
};
