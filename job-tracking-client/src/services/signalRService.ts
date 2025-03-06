/* eslint-disable @typescript-eslint/no-explicit-any */
import * as signalR from "@microsoft/signalr";
import { Message } from "../types/message";
import { Notification } from "../types/notification";

class SignalRService {
    private hubConnection: signalR.HubConnection;
    private notificationHubConnection: signalR.HubConnection;
    private static instance: SignalRService;
    private userId: string | null = null;
    private messageCallbacks: ((message: Message) => void)[] = [];
    private typingCallbacks: ((userId: string) => void)[] = [];
    private stoppedTypingCallbacks: ((userId: string) => void)[] = [];
    private messageReadCallbacks: ((messageId: string) => void)[] = [];
    private userConnectedCallbacks: ((userId: string) => void)[] = [];
    private userDisconnectedCallbacks: ((userId: string) => void)[] = [];
    private notificationCallbacks: ((notification: Notification) => void)[] = [];
    private reconnectInterval: any = null;

    private constructor() {
        // Chat Hub bağlantısı (JobTrackingAPI - 5173)
        this.hubConnection = new signalR.HubConnectionBuilder()
            .withUrl("http://localhost:5173/chatHub", {
                accessTokenFactory: () => localStorage.getItem('token') || ''
            })
            .withAutomaticReconnect([
                0, 2000, 5000, 10000, 15000, 30000 // More aggressive reconnection strategy
            ])
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        // Notification Hub bağlantısı (NotificationAPI - 8080)
        this.notificationHubConnection = new signalR.HubConnectionBuilder()
            .withUrl("http://localhost:8080/notificationHub", {
                accessTokenFactory: () => localStorage.getItem('token') || ''
            })
            .withAutomaticReconnect([
                0, 2000, 5000, 10000, 15000, 30000 // More aggressive reconnection strategy
            ])
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        // Chat event listeners
        this.hubConnection.on("ReceiveMessage", (message: Message) => {
            this.messageCallbacks.forEach(callback => callback(message));
        });

        this.hubConnection.on("UserConnected", (userId: string) => {
            this.userConnectedCallbacks.forEach(callback => callback(userId));
        });

        this.hubConnection.on("UserDisconnected", (userId: string) => {
            this.userDisconnectedCallbacks.forEach(callback => callback(userId));
        });

        this.hubConnection.on("UserIsTyping", (userId: string) => {
            this.typingCallbacks.forEach(callback => callback(userId));
        });

        this.hubConnection.on("UserStoppedTyping", (userId: string) => {
            this.stoppedTypingCallbacks.forEach(callback => callback(userId));
        });

        this.hubConnection.on("MessageRead", (messageId: string) => {
            this.messageReadCallbacks.forEach(callback => callback(messageId));
        });

        // Notification event listener
        this.notificationHubConnection.on("ReceiveNotification", (notification: Notification) => {
            console.log("Received notification:", notification);
            this.notificationCallbacks.forEach(callback => callback(notification));
        });

        // Connection state change handlers
        this.notificationHubConnection.onreconnecting(error => {
            console.warn("Notification hub reconnecting:", error);
        });

        this.notificationHubConnection.onreconnected(connectionId => {
            console.log("Notification hub reconnected with ID:", connectionId);
            // Re-register to user group after reconnection if we have userId
            if (this.userId) {
                this.notificationHubConnection.invoke("JoinUserGroup", this.userId)
                    .catch(err => console.error("Error rejoining user group:", err));
            }
        });

        this.notificationHubConnection.onclose(error => {
            console.error("Notification hub connection closed:", error);
            this.setupReconnection();
        });

        // Error handlers
        this.hubConnection.on("ErrorOccurred", (error: string) => {
            console.error("SignalR Error:", error);
        });
    }

    private setupReconnection() {
        // Clear any existing interval
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
        }

        // Try to reconnect every 5 seconds if connection is lost
        this.reconnectInterval = setInterval(async () => {
            if (this.notificationHubConnection.state === signalR.HubConnectionState.Disconnected && this.userId) {
                try {
                    await this.notificationHubConnection.start();
                    console.log("Notification hub reconnected");
                    
                    // Re-register to user group
                    await this.notificationHubConnection.invoke("JoinUserGroup", this.userId);
                    console.log("Rejoined user group:", this.userId);
                    
                    // Clear the interval if reconnection is successful
                    clearInterval(this.reconnectInterval);
                    this.reconnectInterval = null;
                } catch (err) {
                    console.error("Failed to reconnect to notification hub:", err);
                }
            }
        }, 5000);
    }

    public static getInstance(): SignalRService {
        if (!SignalRService.instance) {
            SignalRService.instance = new SignalRService();
        }
        return SignalRService.instance;
    }

    async startConnection(userId: string): Promise<void> {
        try {
            this.userId = userId;

            // Start Chat Hub connection
            if (this.hubConnection.state === signalR.HubConnectionState.Disconnected) {
                await this.hubConnection.start();
                console.log("Chat Hub connection started with userId: ", userId, "with url: ", this.hubConnection.baseUrl);
            }

            // Start Notification Hub connection
            if (this.notificationHubConnection.state === signalR.HubConnectionState.Disconnected) {
                await this.notificationHubConnection.start();
                console.log("Notification Hub connection started with userId: ", userId, "with url: ", this.notificationHubConnection.baseUrl);
                
                // Explicitly join the user's group for notifications
                await this.notificationHubConnection.invoke("JoinUserGroup", userId);
                console.log("Joined notification group for user:", userId);
            }
        } catch (err) {
            console.error("Error while establishing connection: ", err);
            this.setupReconnection();
            throw err;
        }
    }

    async stopConnection(): Promise<void> {
        try {
            // Clear reconnection interval if it exists
            if (this.reconnectInterval) {
                clearInterval(this.reconnectInterval);
                this.reconnectInterval = null;
            }

            if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
                await this.hubConnection.stop();
            }
            if (this.notificationHubConnection.state === signalR.HubConnectionState.Connected) {
                await this.notificationHubConnection.stop();
            }
        } catch (err) {
            console.error("Error while stopping connection: ", err);
            throw err;
        }
    }

    // Chat Methods
    async sendMessage(receiverId: string, content: string): Promise<void> {
        if (!this.userId) throw new Error("User not authenticated");
        await this.hubConnection.invoke("SendDirectMessage", this.userId, receiverId, content);
    }

    async markMessageAsRead(messageId: string): Promise<void> {
        await this.hubConnection.invoke("MarkMessageAsRead", messageId);
    }

    async sendTypingIndicator(receiverId: string): Promise<void> {
        if (!this.userId) throw new Error("User not authenticated");
        await this.hubConnection.invoke("IsTyping", this.userId, receiverId);
    }

    async sendStoppedTypingIndicator(receiverId: string): Promise<void> {
        if (!this.userId) throw new Error("User not authenticated");
        await this.hubConnection.invoke("StoppedTyping", this.userId, receiverId);
    }

    // Public methods for message handling
    public addMessageCallback(callback: (message: Message) => void): void {
        this.messageCallbacks.push(callback);
    }

    public removeMessageCallback(callback: (message: Message) => void): void {
        const index = this.messageCallbacks.indexOf(callback);
        if (index > -1) {
            this.messageCallbacks.splice(index, 1);
        }
    }

    public addTypingCallback(callback: (userId: string) => void): void {
        this.typingCallbacks.push(callback);
    }

    public removeTypingCallback(callback: (userId: string) => void): void {
        const index = this.typingCallbacks.indexOf(callback);
        if (index > -1) {
            this.typingCallbacks.splice(index, 1);
        }
    }

    public addStoppedTypingCallback(callback: (userId: string) => void): void {
        this.stoppedTypingCallbacks.push(callback);
    }

    public removeStoppedTypingCallback(callback: (userId: string) => void): void {
        const index = this.stoppedTypingCallbacks.indexOf(callback);
        if (index > -1) {
            this.stoppedTypingCallbacks.splice(index, 1);
        }
    }

    // Event Listeners
    onReceiveMessage(callback: (message: Message) => void): void {
        this.messageCallbacks.push(callback);
    }

    onUserTyping(callback: (userId: string) => void): void {
        this.typingCallbacks.push(callback);
    }

    onUserStoppedTyping(callback: (userId: string) => void): void {
        this.stoppedTypingCallbacks.push(callback);
    }

    onMessageRead(callback: (messageId: string) => void): void {
        this.messageReadCallbacks.push(callback);
    }

    onUserConnected(callback: (userId: string) => void): void {
        this.userConnectedCallbacks.push(callback);
    }

    onUserDisconnected(callback: (userId: string) => void): void {
        this.userDisconnectedCallbacks.push(callback);
    }

    // Notification Methods
    onReceiveNotification(callback: (notification: Notification) => void): void {
        // Remove any existing callback with the same reference to avoid duplicates
        this.removeNotificationCallback(callback);
        
        // Add the new callback
        this.notificationCallbacks.push(callback);
    }

    removeNotificationCallback(callback: (notification: Notification) => void): void {
        const index = this.notificationCallbacks.indexOf(callback);
        if (index > -1) {
            this.notificationCallbacks.splice(index, 1);
        }
    }

    async getConnectedUsersCount(): Promise<number> {
        if (this.notificationHubConnection.state !== signalR.HubConnectionState.Connected) {
            console.warn("Notification hub not connected, attempting to reconnect...");
            try {
                await this.notificationHubConnection.start();
                if (this.userId) {
                    await this.notificationHubConnection.invoke("JoinUserGroup", this.userId);
                }
            } catch (err) {
                console.error("Failed to reconnect to notification hub:", err);
                throw new Error("Connection is not established");
            }
        }
        return await this.notificationHubConnection.invoke("GetConnectedUsersCount");
    }

    isConnected(): boolean {
        return this.notificationHubConnection.state === signalR.HubConnectionState.Connected;
    }

    async sendTestNotification(): Promise<void> {
        if (!this.userId) throw new Error("User not authenticated");
        
        if (this.notificationHubConnection.state !== signalR.HubConnectionState.Connected) {
            console.warn("Notification hub not connected, attempting to reconnect...");
            try {
                await this.notificationHubConnection.start();
                await this.notificationHubConnection.invoke("JoinUserGroup", this.userId);
            } catch (err) {
                console.error("Failed to reconnect to notification hub:", err);
                throw new Error("Connection is not established");
            }
        }
        
        await this.notificationHubConnection.invoke("SendTestNotification", this.userId);
    }
}

export default SignalRService;
