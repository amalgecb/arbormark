/**
 * ArborMark - Authentication & Session Management Module (Async Supported)
 */

import { 
    authenticateUser, 
    registerUser, 
    getCurrentUser, 
    logoutUser,
    getApprovedUsernames
} from './storage.js';

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.onAuthStateChangedCallbacks = [];
    }

    init() {
        this.currentUser = getCurrentUser();
        this.triggerAuthStateChange();
    }

    /**
     * Register a callback that fires whenever user logs in or out
     */
    onAuthStateChanged(callback) {
        if (typeof callback === 'function') {
            this.onAuthStateChangedCallbacks.push(callback);
            // Trigger immediately with current state
            callback(this.currentUser);
        }
    }

    triggerAuthStateChange() {
        this.onAuthStateChangedCallbacks.forEach(cb => {
            try {
                cb(this.currentUser);
            } catch (err) {
                console.error("Error running auth state change callback", err);
            }
        });
    }

    /**
     * Check if a username is in the pre-approved admin list (async)
     */
    async isUsernameApproved(username) {
        const approved = await getApprovedUsernames();
        return approved.includes(username.trim().toLowerCase());
    }

    /**
     * Register a new user (async)
     */
    async register(username, password) {
        try {
            await registerUser(username, password);
            // After successful registration, log them in
            return await this.login(username, password);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Log in a user (async)
     */
    async login(username, password) {
        const session = await authenticateUser(username, password);
        if (session) {
            this.currentUser = session;
            this.triggerAuthStateChange();
            return session;
        } else {
            throw new Error('Invalid username or password.');
        }
    }

    /**
     * Log out the current user
     */
    logout() {
        logoutUser();
        this.currentUser = null;
        this.triggerAuthStateChange();
    }

    /**
     * Helper checks
     */
    isLoggedIn() {
        return !!this.currentUser;
    }

    isAdmin() {
        return this.currentUser && this.currentUser.isAdmin;
    }

    getUsername() {
        return this.currentUser ? this.currentUser.username : null;
    }
}

export const auth = new AuthManager();
export default auth;
