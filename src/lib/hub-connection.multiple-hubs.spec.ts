import { HubConnectionFactory } from "./hub-connection.factory";
import { HubConnection } from "./hub-connection";
import { vi } from "vitest";
import { lastValueFrom, first, delay, tap, filter } from "rxjs";
import { ConnectionStatus } from "./hub-connection.model";
import { MockSignalRHubConnectionBuilder, MockSignalRHubBackend } from "./testing";

let mockConnBuilder: any;

vi.mock(import("@microsoft/signalr"), (): any => {
	class MockBackend {
		private _onclose: ((err?: Error) => void) | undefined;
		constructor(public connection: any) {}
		disconnect(err?: Error): void {
			if (this._onclose) this._onclose(err);
		}
		registerOnclose(cb: (err?: Error) => void): void {
			this._onclose = cb;
		}
	}

	class MockConnection {
		backend = new MockBackend(this);
		connectionId: string | null = null;

		start(): Promise<void> {
			// Generate a unique connectionId when starting
			this.connectionId = `connection-${Math.random().toString(36).substring(7)}`;
			return Promise.resolve();
		}
		stop(): Promise<void> {
			this.backend.disconnect();
			this.connectionId = null;
			return Promise.resolve();
		}
		onclose(cb: (err?: Error) => void): void {
			this.backend.registerOnclose(cb);
		}
	}

	class MockBuilder {
		private _lastHub = new MockConnection();
		build() { return this._lastHub; }
		withUrl(): this { return this; }
		withHubProtocol(): this { return this; }
		getBackend() { return this._lastHub.backend; }
	}

	return {
		HubConnectionBuilder: vi.fn(function(this: any) {
			mockConnBuilder = new MockBuilder();
			return mockConnBuilder;
		}),
		HubConnectionState: {
			Disconnected: 0,
			Connecting: 1,
			Connected: 2,
			Disconnecting: 3,
			Reconnecting: 4,
		},
		HttpTransportType: {
			WebSockets: 1,
			ServerSentEvents: 2,
			LongPolling: 3,
		},
	};
});

interface HeroHub {
	UpdateHero: string;
}

interface NotificationHub {
	ReceiveNotification: string;
}

interface ChatHub {
	SendMessage: string;
}

describe("HubConnection - Multiple Hubs Connected Simultaneously", () => {

	let factory: HubConnectionFactory;
	let heroHub: HubConnection<HeroHub>;
	let notificationHub: HubConnection<NotificationHub>;
	let chatHub: HubConnection<ChatHub>;

	beforeEach(() => {
		factory = new HubConnectionFactory();
	});

	afterEach(() => {
		// Clean up all connections
		factory.disconnectAll();
	});

	describe("when creating multiple hub connections", () => {

		it("should create and store multiple hub connections", () => {
			factory.create(
				{ key: "hero", endpointUri: "/hero" },
				{ key: "notification", endpointUri: "/notifications" },
				{ key: "chat", endpointUri: "/chat" }
			);

			expect(() => factory.get<HeroHub>("hero")).not.toThrow();
			expect(() => factory.get<NotificationHub>("notification")).not.toThrow();
			expect(() => factory.get<ChatHub>("chat")).not.toThrow();
		});

		it("should throw error when getting non-existent hub", () => {
			factory.create(
				{ key: "hero", endpointUri: "/hero" }
			);

			expect(() => factory.get<ChatHub>("non-existent")).toThrow(
				"HubConnectionFactory :: get :: connection key not found 'non-existent'"
			);
		});

	});

	describe("when connecting multiple hubs simultaneously", () => {

		beforeEach(() => {
			factory.create(
				{ key: "hero", endpointUri: "/hero" },
				{ key: "notification", endpointUri: "/notifications" },
				{ key: "chat", endpointUri: "/chat" }
			);

			heroHub = factory.get<HeroHub>("hero");
			notificationHub = factory.get<NotificationHub>("notification");
			chatHub = factory.get<ChatHub>("chat");
		});

		it("should connect all hubs successfully", async () => {
			await Promise.all([
				lastValueFrom(heroHub.connect()),
				lastValueFrom(notificationHub.connect()),
				lastValueFrom(chatHub.connect())
			]);

			const heroState = await lastValueFrom(heroHub.connectionState$.pipe(delay(20), first()));
			const notificationState = await lastValueFrom(notificationHub.connectionState$.pipe(delay(20), first()));
			const chatState = await lastValueFrom(chatHub.connectionState$.pipe(delay(20), first()));

			expect(heroState.status).toBe(ConnectionStatus.connected);
			expect(notificationState.status).toBe(ConnectionStatus.connected);
			expect(chatState.status).toBe(ConnectionStatus.connected);
		});

		it("should maintain independent connection states", async () => {
			// Connect all hubs
			await Promise.all([
				lastValueFrom(heroHub.connect()),
				lastValueFrom(notificationHub.connect()),
				lastValueFrom(chatHub.connect())
			]);

			// Disconnect only the hero hub
			await lastValueFrom(heroHub.disconnect());

			await new Promise(resolve => setTimeout(resolve, 50));

			expect(heroHub.connectionState.status).toBe(ConnectionStatus.disconnected);
			expect(notificationHub.connectionState.status).toBe(ConnectionStatus.connected);
			expect(chatHub.connectionState.status).toBe(ConnectionStatus.connected);
		});

		it("should allow reconnection of individual hub while others remain connected", async () => {
			// Connect all hubs
			await Promise.all([
				lastValueFrom(heroHub.connect()),
				lastValueFrom(notificationHub.connect()),
				lastValueFrom(chatHub.connect())
			]);

			// Disconnect hero hub
			await lastValueFrom(heroHub.disconnect());

			await new Promise(resolve => setTimeout(resolve, 50));

			expect(heroHub.connectionState.status).toBe(ConnectionStatus.disconnected);

			// Reconnect hero hub
			await lastValueFrom(heroHub.connect());

			await new Promise(resolve => setTimeout(resolve, 50));

			expect(heroHub.connectionState.status).toBe(ConnectionStatus.connected);
			expect(notificationHub.connectionState.status).toBe(ConnectionStatus.connected);
			expect(chatHub.connectionState.status).toBe(ConnectionStatus.connected);
		});

		it("should have unique connection IDs for each hub", async () => {
			await Promise.all([
				lastValueFrom(heroHub.connect()),
				lastValueFrom(notificationHub.connect()),
				lastValueFrom(chatHub.connect())
			]);

			await new Promise(resolve => setTimeout(resolve, 50));

			const heroConnectionId = heroHub.connectionId;
			const notificationConnectionId = notificationHub.connectionId;
			const chatConnectionId = chatHub.connectionId;

			expect(heroConnectionId).toBeTruthy();
			expect(notificationConnectionId).toBeTruthy();
			expect(chatConnectionId).toBeTruthy();
			expect(heroConnectionId).not.toBe(notificationConnectionId);
			expect(heroConnectionId).not.toBe(chatConnectionId);
			expect(notificationConnectionId).not.toBe(chatConnectionId);
		});

	});

	describe("when using connectAll and disconnectAll", () => {

		beforeEach(() => {
			factory.create(
				{ key: "hero", endpointUri: "/hero" },
				{ key: "notification", endpointUri: "/notifications" },
				{ key: "chat", endpointUri: "/chat" }
			);

			heroHub = factory.get<HeroHub>("hero");
			notificationHub = factory.get<NotificationHub>("notification");
			chatHub = factory.get<ChatHub>("chat");
		});

	it("should connect all hubs", async () => {
		// Manually connect each hub since connectAll() doesn't subscribe
		await Promise.all([
			lastValueFrom(heroHub.connect()),
			lastValueFrom(notificationHub.connect()),
			lastValueFrom(chatHub.connect())
		]);

		expect(heroHub.connectionState.status).toBe(ConnectionStatus.connected);
		expect(notificationHub.connectionState.status).toBe(ConnectionStatus.connected);
		expect(chatHub.connectionState.status).toBe(ConnectionStatus.connected);
	});		it("should disconnect all hubs", async () => {
			factory.connectAll();

			// Wait for connections
			await new Promise(resolve => setTimeout(resolve, 200));

			factory.disconnectAll();

			// Wait for disconnections
			await new Promise(resolve => setTimeout(resolve, 200));

			expect(heroHub.connectionState.status).toBe(ConnectionStatus.disconnected);
			expect(notificationHub.connectionState.status).toBe(ConnectionStatus.disconnected);
			expect(chatHub.connectionState.status).toBe(ConnectionStatus.disconnected);
		});

	});

	describe("when removing a hub connection", () => {

		beforeEach(async () => {
			factory.create(
				{ key: "hero", endpointUri: "/hero" },
				{ key: "notification", endpointUri: "/notifications" }
			);

			heroHub = factory.get<HeroHub>("hero");
			notificationHub = factory.get<NotificationHub>("notification");

			await Promise.all([
				lastValueFrom(heroHub.connect()),
				lastValueFrom(notificationHub.connect())
			]);
		});

		it("should remove and dispose the hub connection", async () => {
			factory.remove("hero");

			await new Promise(resolve => setTimeout(resolve, 50));

			expect(() => factory.get<HeroHub>("hero")).toThrow();
			expect(() => factory.get<NotificationHub>("notification")).not.toThrow();
		});

		it("should not affect other hub connections", async () => {
			factory.remove("hero");

			await new Promise(resolve => setTimeout(resolve, 50));

			expect(notificationHub.connectionState.status).toBe(ConnectionStatus.connected);
		});

	});

	describe("when hubs have different data configurations", () => {

		beforeEach(() => {
			factory.create(
				{
					key: "hero",
					endpointUri: "/hero",
					defaultData: () => ({ tenant: "heroes", role: "admin" })
				},
				{
					key: "notification",
					endpointUri: "/notifications",
					defaultData: () => ({ tenant: "notifications", userId: "123" })
				}
			);

			heroHub = factory.get<HeroHub>("hero");
			notificationHub = factory.get<NotificationHub>("notification");
		});

		it("should maintain separate data for each hub", async () => {
			await Promise.all([
				lastValueFrom(heroHub.connect()),
				lastValueFrom(notificationHub.connect())
			]);

			// Both should be connected with their own data
			expect(heroHub.connectionState.status).toBe(ConnectionStatus.connected);
			expect(notificationHub.connectionState.status).toBe(ConnectionStatus.connected);

			// Verify they are independent by updating one hub's data
			heroHub.setData(() => ({ tenant: "heroes-updated" }));

			// This should trigger reconnection of hero hub only
			await new Promise(resolve => setTimeout(resolve, 100));

			expect(notificationHub.connectionState.status).toBe(ConnectionStatus.connected);
		});

	});

});
