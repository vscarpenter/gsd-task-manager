import { runBackgroundNotifications, type BackgroundContext } from './background';

const worker = globalThis as unknown as BackgroundContext & {
  checkBackgroundNotifications: () => Promise<void>;
};
worker.checkBackgroundNotifications = () => runBackgroundNotifications(worker);
