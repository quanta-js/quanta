import React, { useState } from 'react';
import {
    QuantaProvider,
    useStore,
    useQuantaStore,
    useCreateStore,
    useComputed,
    useWatch,
} from '@quantajs/react';
import { createStore } from '@quantajs/core';

// Global store example
const userStore = createStore('user', {
    state: () => ({
        name: 'Guest',
        email: '',
        preferences: {
            theme: 'light' as 'light' | 'dark',
            notifications: true,
        },
    }),
    getters: {
        displayName: (state) => state.name || 'Anonymous',
        isLoggedIn: (state) => state.name !== 'Guest',
    },
    actions: {
        login(name: string, email: string) {
            this.name = name;
            this.email = email;
        },
        logout() {
            this.name = 'Guest';
            this.email = '';
        },
        updatePreferences(preferences: Partial<typeof this.preferences>) {
            Object.assign(this.preferences, preferences);
        },
    },
});

// Component using context store
function UserProfile() {
    const store = useStore();
    const [nameInput, setNameInput] = useState('');
    const [emailInput, setEmailInput] = useState('');

    const handleLogin = () => {
        if (nameInput && emailInput) {
            store.login(nameInput, emailInput);
            setNameInput('');
            setEmailInput('');
        }
    };

    return (
        <div
            style={{
                padding: '20px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                marginBottom: '20px',
            }}
        >
            <h3>User Profile (Context Store)</h3>

            {store.isLoggedIn ? (
                <div>
                    <p>
                        <strong>Name:</strong> {store.displayName}
                    </p>
                    <p>
                        <strong>Email:</strong> {store.email}
                    </p>
                    <p>
                        <strong>Theme:</strong> {store.preferences.theme}
                    </p>
                    <button onClick={() => store.logout()}>Logout</button>
                    <button
                        onClick={() =>
                            store.updatePreferences({
                                theme:
                                    store.preferences.theme === 'light'
                                        ? 'dark'
                                        : 'light',
                            })
                        }
                        style={{ marginLeft: '10px' }}
                    >
                        Toggle Theme
                    </button>
                </div>
            ) : (
                <div>
                    <input
                        placeholder="Name"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        style={{ marginRight: '10px' }}
                    />
                    <input
                        placeholder="Email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        style={{ marginRight: '10px' }}
                    />
                    <button onClick={handleLogin}>Login</button>
                </div>
            )}
        </div>
    );
}

// Component using direct store reference
function NotificationCenter() {
    const notifications = useQuantaStore(
        userStore,
        (store) => store.preferences.notifications,
    );
    const theme = useQuantaStore(userStore, (store) => store.preferences.theme);

    return (
        <div
            style={{
                padding: '20px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                marginBottom: '20px',
                backgroundColor: theme === 'dark' ? '#333' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000',
            }}
        >
            <h3>Notification Center (Direct Store)</h3>
            <p>Notifications: {notifications ? 'Enabled' : 'Disabled'}</p>
            <button
                onClick={() =>
                    userStore.updatePreferences({
                        notifications: !notifications,
                    })
                }
            >
                {notifications ? 'Disable' : 'Enable'} Notifications
            </button>
        </div>
    );
}

// Component with component-scoped store
function TodoList() {
    const todoStore = useCreateStore(
        'todos',
        () => ({
            todos: [] as Array<{
                id: number;
                text: string;
                completed: boolean;
            }>,
            filter: 'all' as 'all' | 'active' | 'completed',
        }),
        {
            filteredTodos: (state) => {
                switch (state.filter) {
                    case 'active':
                        return state.todos.filter((t) => !t.completed);
                    case 'completed':
                        return state.todos.filter((t) => t.completed);
                    default:
                        return state.todos;
                }
            },
            activeCount: (state) =>
                state.todos.filter((t) => !t.completed).length,
        },
        {
            addTodo(text: string) {
                this.todos.push({
                    id: Date.now(),
                    text,
                    completed: false,
                });
            },
            toggleTodo(id: number) {
                const todo = this.todos.find((t) => t.id === id);
                if (todo) todo.completed = !todo.completed;
            },
            setFilter(filter: 'all' | 'active' | 'completed') {
                this.filter = filter;
            },
        },
    );

    const [newTodo, setNewTodo] = useState('');

    const handleAdd = () => {
        if (newTodo.trim()) {
            todoStore.addTodo(newTodo.trim());
            setNewTodo('');
        }
    };

    return (
        <div
            style={{
                padding: '20px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                marginBottom: '20px',
            }}
        >
            <h3>Todo List (Component Store)</h3>

            <div style={{ marginBottom: '10px' }}>
                <input
                    placeholder="Add new todo..."
                    value={newTodo}
                    onChange={(e) => setNewTodo(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                    style={{ marginRight: '10px' }}
                />
                <button onClick={handleAdd}>Add</button>
            </div>

            <div style={{ marginBottom: '10px' }}>
                <button
                    onClick={() => todoStore.setFilter('all')}
                    style={{
                        fontWeight:
                            todoStore.filter === 'all' ? 'bold' : 'normal',
                        marginRight: '5px',
                    }}
                >
                    All ({todoStore.todos.length})
                </button>
                <button
                    onClick={() => todoStore.setFilter('active')}
                    style={{
                        fontWeight:
                            todoStore.filter === 'active' ? 'bold' : 'normal',
                        marginRight: '5px',
                    }}
                >
                    Active ({todoStore.activeCount})
                </button>
                <button
                    onClick={() => todoStore.setFilter('completed')}
                    style={{
                        fontWeight:
                            todoStore.filter === 'completed'
                                ? 'bold'
                                : 'normal',
                    }}
                >
                    Completed ({todoStore.todos.length - todoStore.activeCount})
                </button>
            </div>

            <ul style={{ listStyle: 'none', padding: 0 }}>
                {todoStore.filteredTodos.map((todo) => (
                    <li key={todo.id} style={{ marginBottom: '5px' }}>
                        <label
                            style={{ display: 'flex', alignItems: 'center' }}
                        >
                            <input
                                type="checkbox"
                                checked={todo.completed}
                                onChange={() => todoStore.toggleTodo(todo.id)}
                                style={{ marginRight: '8px' }}
                            />
                            <span
                                style={{
                                    textDecoration: todo.completed
                                        ? 'line-through'
                                        : 'none',
                                    opacity: todo.completed ? 0.6 : 1,
                                }}
                            >
                                {todo.text}
                            </span>
                        </label>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// Component demonstrating computed values and watchers
function Analytics() {
    const userCount = useQuantaStore(userStore, (store) =>
        store.isLoggedIn ? 1 : 0,
    );

    // Example of useComputed (though in this case we could just use a selector)
    const userStatus = useComputed(
        userStore,
        (store) => ({
            status: store.isLoggedIn ? 'online' : 'offline',
            lastUpdate: new Date().toLocaleTimeString(),
        }),
        [userCount], // dependency array
    );

    // Example of useWatch for side effects
    useWatch(
        userStore,
        (store) => store.isLoggedIn,
        (isLoggedIn) => {
            console.log(
                `User ${isLoggedIn ? 'logged in' : 'logged out'} at ${new Date().toLocaleTimeString()}`,
            );
        },
    );

    return (
        <div
            style={{
                padding: '20px',
                border: '1px solid #ddd',
                borderRadius: '8px',
            }}
        >
            <h3>Analytics (Computed & Watchers)</h3>
            <p>
                <strong>User Status:</strong> {userStatus.status}
            </p>
            <p>
                <strong>Last Update:</strong> {userStatus.lastUpdate}
            </p>
            <p>
                <strong>Active Users:</strong> {userCount}
            </p>
            <small>Check the console for login/logout events.</small>
        </div>
    );
}

// Main app component
function AdvancedExample() {
    return (
        <QuantaProvider store={userStore}>
            <div
                style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}
            >
                <h1>QuantaJS React Advanced Example</h1>
                <p>
                    This example demonstrates various usage patterns with
                    QuantaJS React integration.
                </p>

                <UserProfile />
                <NotificationCenter />
                <TodoList />
                <Analytics />
            </div>
        </QuantaProvider>
    );
}

export default AdvancedExample;
