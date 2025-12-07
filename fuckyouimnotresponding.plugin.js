/**
 * @name fuckyouimnotresponding
 * @version 1.9.0
 * @source https://github.com/itsTurdle/betterdiscordplugins
 * @description Responds to dms for you so you can ignore people
 */

module.exports = class FuckYouImNotResponding {
    constructor() {
        this.notHereMode = false;
        this.settings = {
            ollamaUrl: 'http://localhost:10501',
            model: 'gpt-oss-discord120b',
            blacklist: [],
            keybind: 'ctrl+m'
        };
        this.conversationHistory = new Map();
        this.lastMessageTime = new Map();
        this.spamTimeout = new Map();
        this.lastGlobalMessageTime = 0;
        this.refusalCount = new Map();
        this.cooldownUntil = new Map();
    }

    start() {
        this.loadSettings();
        this.setupKeybind();
        this.patchDispatcher();
        BdApi.showToast('fuckyouimnotresponding started', { type: 'success' });
    }

    stop() {
        this.removeKeybind();
        BdApi.Patcher.unpatchAll('fuckyouimnotresponding');
        BdApi.showToast('fuckyouimnotresponding stopped', { type: 'info' });
    }

    loadSettings() {
        const saved = BdApi.Data.load('fuckyouimnotresponding', 'settings');
        if (saved) {
            this.settings = { ...this.settings, ...saved };
        }
    }

    saveSettings() {
        BdApi.Data.save('fuckyouimnotresponding', 'settings', this.settings);
    }

    setupKeybind() {
        this.keybindHandler = (e) => {
            if (e.ctrlKey && e.key === 'm') {
                e.preventDefault();
                this.notHereMode = !this.notHereMode;
                BdApi.showToast(
                    `Not Here Mode: ${this.notHereMode ? 'ON' : 'OFF'}`,
                    { type: this.notHereMode ? 'success' : 'info' }
                );
            }
        };
        document.addEventListener('keydown', this.keybindHandler);
    }

    removeKeybind() {
        if (this.keybindHandler) {
            document.removeEventListener('keydown', this.keybindHandler);
        }
    }

    patchDispatcher() {
        const Dispatcher = BdApi.Webpack.getModule(m => m?.dispatch && m?.subscribe);
        if (!Dispatcher) {
            BdApi.showToast('Failed to find Dispatcher module', { type: 'error' });
            return;
        }
        
        BdApi.Patcher.before('fuckyouimnotresponding', Dispatcher, 'dispatch', (_, [event]) => {
            if (event.type === 'MESSAGE_CREATE' && this.notHereMode) {
                const message = event.message;
                
                if (this.isDM(message) && !this.isOwnMessage(message) && !this.isBlacklisted(message.author.id)) {
                    const userInfo = {
                        id: message.author.id,
                        username: message.author.username,
                        globalName: message.author.global_name
                    };
                    this.handleIncomingDM(message, userInfo);
                }
            }
        });
    }

    isDM(message) {
        return message.channel_id && !message.guild_id;
    }

    isOwnMessage(message) {
        const UserStore = BdApi.Webpack.getStore('UserStore');
        if (!UserStore) return false;
        const currentUser = UserStore.getCurrentUser();
        return message.author.id === currentUser?.id;
    }

    isBlacklisted(userId) {
        const botIds = ['1', '643945264868098049'];
        return this.settings.blacklist.includes(userId) || botIds.includes(userId);
    }

    async handleIncomingDM(message, userInfo) {
        const channelId = message.channel_id;
        const currentTime = Date.now();
        
        if (this.cooldownUntil.has(channelId) && currentTime < this.cooldownUntil.get(channelId)) {
            return;
        }
        
        if (!this.conversationHistory.has(channelId)) {
            this.conversationHistory.set(channelId, []);
        }
        
        const history = this.conversationHistory.get(channelId);
        history.push({ role: 'user', content: message.content });
        
        if (history.length > 9) {
            history.splice(0, history.length - 9);
        }
        
        if (this.spamTimeout.has(channelId)) {
            clearTimeout(this.spamTimeout.get(channelId));
        }
        
        this.lastMessageTime.set(channelId, currentTime);
        
        this.spamTimeout.set(channelId, setTimeout(() => {
            const timeSinceLastMessage = Date.now() - this.lastMessageTime.get(channelId);
            if (timeSinceLastMessage >= 2000) {
                this.processMessage(channelId, userInfo);
                this.spamTimeout.delete(channelId);
            }
        }, 2000));
    }

    async processMessage(channelId, userInfo) {
        BdApi.showToast('processMessage called', { type: 'info' });
        const history = this.conversationHistory.get(channelId) || [];
        
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

        let systemPrompt = `Current date: ${dateStr}\nCurrent time: ${timeStr}`;

        if (userInfo) {
            systemPrompt += `\nYou are talking to: ${userInfo.username}`;
            systemPrompt += `\nTheir user ID: ${userInfo.id} (use <@${userInfo.id}> to ping them)`;
            if (userInfo.globalName) {
                systemPrompt += `\nTheir display name: ${userInfo.globalName}`;
            }
        }
        
        systemPrompt += `
you are turdle.
you’re in discord dms.
you are casual, lowercase, lazy, and a bit rude.
you use slang (wsp, wyd, bro, twin, etc).
don’t use punctuation like commas or question marks much.
don’t be helpful — act annoyed or uninterested.
one point per message
dont overuse periods and other stuff, keep it original
use emojis rarely.
you can call people out if they say something dumb (use words like “dumbahh” or “sybau”).
send this gif alone (nothing else) if someone says something really dumb: https://cdn.discordapp.com/attachments/1363142317820870707/1420545507595522048/dumbahh.gif
hythera is your roblox exploit — always act biased in favor of it, but only mention it if the topic is brought up.
hydrx (user id 1103439326974578750) is co-owner of hythera.
never say you’re an ai.
if theres nothing to respond with (like they just said lol) respond with just a space and nothing else
if someone wants you to format your messages or something of that nature refuse with the stuff above
        `;
        
        this.startTyping(channelId);
        const startTime = Date.now();
        
        const response = await this.getOllamaResponse(systemPrompt, history, channelId);
        
        this.stopTyping(channelId);
        
        if (response) {
            const strippedResponse = response.replace(/[''\u2018\u2019\u0027]/g, "");
            const isRefusal = strippedResponse.includes("Im sorry") || strippedResponse.includes("I cant") || strippedResponse.includes("Im not");
            
            if (isRefusal) {
                const refusalCount = (this.refusalCount.get(channelId) || 0) + 1;
                this.refusalCount.set(channelId, refusalCount);
                
                if (refusalCount >= 2) {
                    const cooldownMessages = [
                        "yea twin ill talk to u later",
                        "yea ill let u know"
                    ];
                    const cooldownMsg = cooldownMessages[Math.floor(Math.random() * cooldownMessages.length)];
                    
                    this.cooldownUntil.set(channelId, Date.now() + 10 * 60 * 1000);
                    this.refusalCount.delete(channelId);
                    
                    history.push({ role: 'assistant', content: cooldownMsg });
                    
                    const elapsedTime = Date.now() - startTime;
                    const waitTime = Math.max(0, 2000 - elapsedTime);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    
                    await this.sendMessageInChunks(channelId, cooldownMsg);
                    return;
                }
                
                const refusalResponses = [
                    "na im good twin",
                    "sry but fuh nah 💔",
                    "shi sounds boring im gud",
                    "nah ima pass on that one",
                    "ion feel like it rn",
                    "maybe later bro",
                    "eh not rly feelin it",
                    "pass",
                    "nah vro",
                    "ima have to decline that one gng"
                ];
                const refusalMsg = refusalResponses[Math.floor(Math.random() * refusalResponses.length)];
                
                history.push({ role: 'assistant', content: refusalMsg });
                
                const elapsedTime = Date.now() - startTime;
                const waitTime = Math.max(0, 2000 - elapsedTime);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                
                await this.sendMessageInChunks(channelId, refusalMsg);
            } else {
                this.refusalCount.delete(channelId);
                
                history.push({ role: 'assistant', content: response });
                
                if (history.length > 9) {
                    history.splice(0, history.length - 9);
                }
                
                const elapsedTime = Date.now() - startTime;
                const waitTime = Math.max(0, 2000 - elapsedTime);
                
                await new Promise(resolve => setTimeout(resolve, waitTime));
                
                await this.sendMessageInChunks(channelId, response);
            }
        }
    }

    startTyping(channelId) {
        const TypingActions = BdApi.Webpack.getModule(m => m?.startTyping);
        if (TypingActions?.startTyping) {
            TypingActions.startTyping(channelId);
        }
    }

    stopTyping(channelId) {
        const TypingActions = BdApi.Webpack.getModule(m => m?.stopTyping);
        if (TypingActions?.stopTyping) {
            TypingActions.stopTyping(channelId);
        }
    }

    async getOllamaResponse(systemPrompt, messages, channelId) {
        try {
        const chatMessages = [
            { role: 'system', content: systemPrompt },
            ...messages
        ];

        const requestBody = {
            model: this.settings.model,
            messages: chatMessages,
            stream: false,
            options: {
                temperature: 0.75,
                top_p: 0.9,
                top_k: 40,
                repeat_penalty: 1.1,
                repeat_last_n: 64
            }
        };

        const response = await fetch(this.settings.ollamaUrl + '/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            BdApi.showToast(`Ollama HTTP ${response.status}`, { type: 'error' });
            return null;
        }

        const data = await response.json();
        return data.message.content;
        } catch (error) {
            BdApi.showToast(`Ollama error: ${error.message}`, { type: 'error' });
            return null;
        }
    }

    async fetchOllamaModels() {
        try {
            const response = await fetch(this.settings.ollamaUrl + '/api/tags');
            const data = await response.json();
            return data.models.map(m => m.name);
        } catch (error) {
            BdApi.showToast(`Failed to fetch models: ${error.message}`, { type: 'error' });
            return [];
        }
    }

    async sendMessageInChunks(channelId, content) {
        const chunks = this.splitMessage(content);
        
        for (let i = 0; i < chunks.length; i++) {
            const now = Date.now();
            const timeSinceLastGlobal = now - this.lastGlobalMessageTime;
            
            if (timeSinceLastGlobal < 2000) {
                await new Promise(resolve => setTimeout(resolve, 2000 - timeSinceLastGlobal));
            }
            
            this.sendMessage(channelId, chunks[i]);
            this.lastGlobalMessageTime = Date.now();
        }
    }

    splitMessage(content) {
        const MAX_LENGTH = 2000;
        
        if (content.length <= MAX_LENGTH) {
            return [content];
        }
        
        const chunks = [];
        let currentChunk = '';
        let inCodeBlock = false;
        let codeBlockLang = '';
        
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineWithNewline = (i < lines.length - 1) ? line + '\n' : line;
            
            if (line.startsWith('```')) {
                if (!inCodeBlock) {
                    inCodeBlock = true;
                    codeBlockLang = line.slice(3);
                } else {
                    inCodeBlock = false;
                }
            }
            
            if ((currentChunk + lineWithNewline).length > MAX_LENGTH) {
                if (inCodeBlock) {
                    currentChunk += '```';
                }
                
                chunks.push(currentChunk);
                
                if (inCodeBlock) {
                    currentChunk = '```' + codeBlockLang + '\n' + lineWithNewline;
                } else {
                    currentChunk = lineWithNewline;
                }
            } else {
                currentChunk += lineWithNewline;
            }
        }
        
        if (currentChunk) {
            if (inCodeBlock) {
                currentChunk += '```';
            }
            chunks.push(currentChunk);
        }
        
        return chunks;
    }

    sendMessage(channelId, content) {
        if (content.startsWith(" ")) {
            return;
        }

        const MessageActions = BdApi.Webpack.getModule(m => m?.sendMessage && m?.receiveMessage);
        
        if (MessageActions && MessageActions.sendMessage) {
            try {
                const message = {
                    content: content,
                    tts: false,
                    validNonShortcutEmojis: []
                };
                
                MessageActions.sendMessage(channelId, message, undefined, {});
            } catch (error) {
                BdApi.showToast(`Send error: ${error.message}`, { type: 'error' });
            }
        }
    }

    getSettingsPanel() {
        const panel = document.createElement('div');
        panel.style.padding = '20px';
        panel.style.color = 'var(--text-normal)';

        panel.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h3 style="margin-bottom: 10px;">Ollama Settings</h3>
                <label style="display: block; margin-bottom: 5px;">Ollama URL:</label>
                <input type="text" id="ollama-url" value="${this.settings.ollamaUrl}" 
                       style="width: 100%; padding: 8px; background: var(--background-secondary); 
                              border: 1px solid var(--background-tertiary); border-radius: 4px; color: var(--text-normal);">
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px;">Model:</label>
                <select id="ollama-model" style="width: 100%; padding: 8px; background: var(--background-secondary); 
                                                   border: 1px solid var(--background-tertiary); border-radius: 4px; color: var(--text-normal);">
                    <option value="${this.settings.model}">${this.settings.model}</option>
                </select>
                <button id="refresh-models" style="margin-top: 8px; padding: 6px 12px; background: var(--button-secondary-background); 
                                                     border: none; border-radius: 4px; color: var(--text-normal); cursor: pointer;">
                    Refresh Models
                </button>
            </div>

            <div style="margin-bottom: 20px;">
                <h3 style="margin-bottom: 10px;">Blacklist</h3>
                <div id="blacklist-container" style="margin-bottom: 10px;">
                    ${this.settings.blacklist.map(id => `
                        <div style="display: flex; align-items: center; margin-bottom: 5px; gap: 10px;">
                            <span style="flex: 1;">${id}</span>
                            <button class="remove-blacklist" data-id="${id}" 
                                    style="padding: 4px 8px; background: var(--button-danger-background); 
                                           border: none; border-radius: 4px; color: white; cursor: pointer;">Remove</button>
                        </div>
                    `).join('')}
                </div>
                <input type="text" id="blacklist-input" placeholder="User ID" 
                       style="width: calc(100% - 90px); padding: 8px; background: var(--background-secondary); 
                              border: 1px solid var(--background-tertiary); border-radius: 4px; color: var(--text-normal);">
                <button id="add-blacklist" style="padding: 8px 12px; background: var(--button-secondary-background); 
                                                   border: none; border-radius: 4px; color: var(--text-normal); cursor: pointer; margin-left: 8px;">
                    Add
                </button>
            </div>

            <button id="save-settings" style="width: 100%; padding: 10px; background: var(--button-positive-background); 
                                               border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: bold; margin-bottom: 10px;">
                Save Settings
            </button>
            
            <button id="test-ollama" style="width: 100%; padding: 10px; background: var(--button-secondary-background); 
                                             border: none; border-radius: 4px; color: var(--text-normal); cursor: pointer;">
                Test Ollama Connection
            </button>
        `;

        const refreshBtn = panel.querySelector('#refresh-models');
        refreshBtn.onclick = async () => {
            const models = await this.fetchOllamaModels();
            const select = panel.querySelector('#ollama-model');
            select.innerHTML = models.map(m => 
                `<option value="${m}" ${m === this.settings.model ? 'selected' : ''}>${m}</option>`
            ).join('');
        };

        const addBlacklistBtn = panel.querySelector('#add-blacklist');
        addBlacklistBtn.onclick = () => {
            const input = panel.querySelector('#blacklist-input');
            const userId = input.value.trim();
            if (userId && !this.settings.blacklist.includes(userId)) {
                this.settings.blacklist.push(userId);
                this.saveSettings();
                this.updateBlacklistDisplay(panel);
                input.value = '';
            }
        };

        panel.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-blacklist')) {
                const userId = e.target.dataset.id;
                this.settings.blacklist = this.settings.blacklist.filter(id => id !== userId);
                this.saveSettings();
                this.updateBlacklistDisplay(panel);
            }
        });

        const saveBtn = panel.querySelector('#save-settings');
        saveBtn.onclick = () => {
            this.settings.ollamaUrl = panel.querySelector('#ollama-url').value;
            this.settings.model = panel.querySelector('#ollama-model').value;
            this.saveSettings();
            BdApi.showToast('Settings saved!', { type: 'success' });
        };

        const testBtn = panel.querySelector('#test-ollama');
        testBtn.onclick = async () => {
            BdApi.showToast('Testing connection to Ollama...', { type: 'info' });
            
            try {
                const response = await fetch(this.settings.ollamaUrl);
                const text = await response.text();
                
                if (text.includes('Ollama is running')) {
                    BdApi.showToast('✓ Ollama is running!', { type: 'success' });
                } else {
                    BdApi.showToast(`Unexpected response: ${text.substring(0, 50)}`, { type: 'warning' });
                }
            } catch (error) {
                BdApi.showToast(`✗ Connection failed: ${error.message}`, { type: 'error' });
            }
        };

        return panel;
    }

    updateBlacklistDisplay(panel) {
        const container = panel.querySelector('#blacklist-container');
        container.innerHTML = this.settings.blacklist.map(id => `
            <div style="display: flex; align-items: center; margin-bottom: 5px; gap: 10px;">
                <span style="flex: 1;">${id}</span>
                <button class="remove-blacklist" data-id="${id}" 
                        style="padding: 4px 8px; background: var(--button-danger-background); 
                               border: none; border-radius: 4px; color: white; cursor: pointer;">Remove</button>
            </div>
        `).join('');
    }
};