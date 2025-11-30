import { createStore } from '@quantajs/core';
import { mountDevTools } from '../src/mount';
import '../src/index.css';

// Create some mock stores for testing
const userStore = createStore('userStore', {
    state: () => ({
        user: {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            preferences: {
                theme: 'dark',
                notifications: true,
            },
        },
        isAuthenticated: true,
        lastLogin: new Date().toISOString(),
    }),
    actions: {
        login(payload: { email: string; password: string }) {
            console.log('Login action', payload);
            this.state.isAuthenticated = true;
            this.state.lastLogin = new Date().toISOString();
        },
        logout() {
            this.state.isAuthenticated = false;
            this.state.user = { id: 0, name: '', email: '', preferences: { theme: 'dark', notifications: false } };
        },
        updatePreferences(preferences: Record<string, any>) {
            this.state.user.preferences = { ...this.state.user.preferences, ...preferences };
        },
    },
});

const cartStore = createStore('cartStore', {
    state: () => ({
        items: [
            { id: 1, name: 'Product 1', price: 29.99, quantity: 2 },
            { id: 2, name: 'Product 2', price: 49.99, quantity: 1 },
            { id: 3, name: 'Product 3', price: 19.99, quantity: 3 },
        ],
        total: 169.94,
        discount: 0,
    }),
    actions: {
        addItem(item: any) {
            const existingItem = this.state.items.find((i: any) => i.id === item.id);
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                this.state.items.push({ ...item, quantity: 1 });
            }
            this.state.total = this.state.items.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0);
        },
        removeItem(itemId: number) {
            this.state.items = this.state.items.filter((i: any) => i.id !== itemId);
            this.state.total = this.state.items.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0);
        },
        applyDiscount(discount: number) {
            this.state.discount = discount;
        },
        clearCart() {
            this.state.items = [];
            this.state.total = 0;
            this.state.discount = 0;
        },
    },
});

const appStore = createStore('appStore', {
    state: () => ({
        version: '2.0.0-beta.8',
        environment: 'development',
        features: {
            darkMode: true,
            analytics: false,
            betaFeatures: true,
        },
        serverStatus: 'online',
        lastSync: Date.now(),
    }),
    actions: {
        toggleFeature(featureName: string) {
            (this.state.features as any)[featureName] = !(this.state.features as any)[featureName];
        },
        updateServerStatus(status: string) {
            this.state.serverStatus = status;
        },
        sync() {
            this.state.lastSync = Date.now();
        },
    },
});

// Create a simple test UI
const createTestUI = () => {
    const app = document.createElement('div');
    app.style.cssText = `
        font-family: system-ui, -apple-system, sans-serif;
        max-width: 1200px;
        margin: 0 auto;
        padding: 40px 20px;
        background: #0f172a;
        min-height: 100vh;
        color: #e2e8f0;
    `;

    app.innerHTML = `
        <h1 style="font-size: 2.5rem; margin-bottom: 1rem; color: #38b2ac;">Quanta DevTools - Test Environment</h1>
        <p style="margin-bottom: 2rem; color: #94a3b8;">This is a development environment to test the DevTools UI. Interact with the buttons below to trigger actions and see them in the DevTools.</p>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <!-- User Store -->
            <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; border: 1px solid rgba(56, 178, 172, 0.3);">
                <h2 style="font-size: 1.25rem; margin-bottom: 1rem; color: #38b2ac;">User Store</h2>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button id="login-btn" style="padding: 10px; background: #38b2ac; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                        Login
                    </button>
                    <button id="logout-btn" style="padding: 10px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                        Logout
                    </button>
                    <button id="update-prefs-btn" style="padding: 10px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                        Update Preferences
                    </button>
                </div>
            </div>

            <!-- Cart Store -->
            <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; border: 1px solid rgba(56, 178, 172, 0.3);">
                <h2 style="font-size: 1.25rem; margin-bottom: 1rem; color: #38b2ac;">Cart Store</h2>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button id="add-item-btn" style="padding: 10px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                        Add Item
                    </button>
                    <button id="remove-item-btn" style="padding: 10px; background: #f59e0b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                        Remove Item
                    </button>
                    <button id="apply-discount-btn" style="padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                        Apply Discount
                    </button>
                    <button id="clear-cart-btn" style="padding: 10px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                        Clear Cart
                    </button>
                </div>
            </div>

            <!-- App Store -->
            <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; border: 1px solid rgba(56, 178, 172, 0.3);">
                <h2 style="font-size: 1.25rem; margin-bottom: 1rem; color: #38b2ac;">App Store</h2>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button id="toggle-dark-btn" style="padding: 10px; background: #6366f1; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                        Toggle Dark Mode
                    </button>
                    <button id="toggle-analytics-btn" style="padding: 10px; background: #ec4899; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                        Toggle Analytics
                    </button>
                    <button id="server-status-btn" style="padding: 10px; background: #14b8a6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                        Update Server Status
                    </button>
                    <button id="sync-btn" style="padding: 10px; background: #a855f7; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                        Sync Data
                    </button>
                </div>
            </div>
        </div>

        <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; border: 1px solid rgba(56, 178, 172, 0.3);">
            <h2 style="font-size: 1.25rem; margin-bottom: 1rem; color: #38b2ac;">Instructions</h2>
            <ul style="list-style: disc; padding-left: 20px; color: #94a3b8; line-height: 1.8;">
                <li>Click the buttons above to trigger actions in the stores</li>
                <li>Open the DevTools (look for the Quanta icon in the bottom-right corner)</li>
                <li>Switch between the Inspector and Actions tabs to see store state and action logs</li>
                <li>Select different stores from the sidebar to inspect their state</li>
                <li>The UI uses Shadow DOM for complete style isolation</li>
            </ul>
        </div>
    `;

    return app;
};

// Set up event listeners
const setupEventListeners = () => {
    // User Store actions
    document.getElementById('login-btn')?.addEventListener('click', () => {
        userStore.login({ email: 'test@example.com', password: 'password123' });
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => {
        userStore.logout();
    });

    document.getElementById('update-prefs-btn')?.addEventListener('click', () => {
        userStore.updatePreferences({ theme: Math.random() > 0.5 ? 'dark' : 'light' });
    });

    // Cart Store actions
    document.getElementById('add-item-btn')?.addEventListener('click', () => {
        const newId = Math.floor(Math.random() * 1000);
        cartStore.addItem({
            id: newId,
            name: `Product ${newId}`,
            price: Math.floor(Math.random() * 100) + 10,
        });
    });

    document.getElementById('remove-item-btn')?.addEventListener('click', () => {
        const items = cartStore.getState().items;
        if (items.length > 0) {
            cartStore.removeItem(items[0].id);
        }
    });

    document.getElementById('apply-discount-btn')?.addEventListener('click', () => {
        cartStore.applyDiscount(Math.floor(Math.random() * 30) + 5);
    });

    document.getElementById('clear-cart-btn')?.addEventListener('click', () => {
        cartStore.clearCart();
    });

    // App Store actions
    document.getElementById('toggle-dark-btn')?.addEventListener('click', () => {
        appStore.toggleFeature('darkMode');
    });

    document.getElementById('toggle-analytics-btn')?.addEventListener('click', () => {
        appStore.toggleFeature('analytics');
    });

    document.getElementById('server-status-btn')?.addEventListener('click', () => {
        const statuses = ['online', 'offline', 'maintenance'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        appStore.updateServerStatus(randomStatus);
    });

    document.getElementById('sync-btn')?.addEventListener('click', () => {
        appStore.sync();
    });
};

// Initialize the test environment
const init = () => {
    // Add the test UI to the body
    const testUI = createTestUI();
    document.body.appendChild(testUI);

    // Set up event listeners
    setupEventListeners();

    // Mount the DevTools
    mountDevTools({ visible: true });

    console.log('[Dev Environment] Initialized with 3 test stores:', {
        userStore,
        cartStore,
        appStore,
    });
};

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
