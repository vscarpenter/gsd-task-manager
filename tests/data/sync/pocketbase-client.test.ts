const mockAuthStore = {
  isValid: false,
  token: '',
  record: null as { id: string } | null,
  clear: vi.fn(),
};

const mockPb = {
  autoCancellation: vi.fn(),
  authStore: mockAuthStore,
  collection: vi.fn(),
};

// vi.fn() with a function body that returns mockPb acts as a constructor
const MockPocketBase = vi.fn(function () {
  return mockPb;
});

vi.mock('pocketbase', () => ({
  default: MockPocketBase,
}));

vi.mock('@/lib/env-config', () => ({
  ENV_CONFIG: { pocketBaseUrl: 'https://test.example.com' },
}));

describe('PocketBase Client', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockAuthStore.isValid = false;
    mockAuthStore.token = '';
    mockAuthStore.record = null;

    // Reset module state so each test gets a fresh singleton
    vi.resetModules();
  });

  it('should create PocketBase instance with correct URL', async () => {
    const { getPocketBase } = await import('@/lib/sync/pocketbase-client');

    getPocketBase();

    expect(MockPocketBase).toHaveBeenCalledWith('https://test.example.com');
  });

  it('should return the same instance on subsequent calls (singleton)', async () => {
    const { getPocketBase } = await import('@/lib/sync/pocketbase-client');

    const first = getPocketBase();
    const second = getPocketBase();

    expect(first).toBe(second);
    expect(MockPocketBase).toHaveBeenCalledTimes(1);
  });

  it('should create a new instance after clearPocketBase', async () => {
    const { getPocketBase, clearPocketBase } = await import('@/lib/sync/pocketbase-client');

    getPocketBase();
    expect(MockPocketBase).toHaveBeenCalledTimes(1);

    clearPocketBase();
    getPocketBase();
    expect(MockPocketBase).toHaveBeenCalledTimes(2);
  });

  it('should return authStore.isValid from isAuthenticated', async () => {
    const { isAuthenticated } = await import('@/lib/sync/pocketbase-client');

    mockAuthStore.isValid = false;
    expect(isAuthenticated()).toBe(false);

    mockAuthStore.isValid = true;
    expect(isAuthenticated()).toBe(true);
  });

  it('should return null from getCurrentUserId when not authenticated', async () => {
    const { getCurrentUserId } = await import('@/lib/sync/pocketbase-client');

    mockAuthStore.isValid = false;
    mockAuthStore.record = null;

    expect(getCurrentUserId()).toBeNull();
  });

  it('should return record.id from getCurrentUserId when authenticated', async () => {
    const { getCurrentUserId } = await import('@/lib/sync/pocketbase-client');

    mockAuthStore.isValid = true;
    mockAuthStore.record = { id: 'user-abc-123' };

    expect(getCurrentUserId()).toBe('user-abc-123');
  });
});
