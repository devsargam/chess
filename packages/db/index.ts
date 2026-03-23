interface UserRecord {
  id: string;
  username: string;
  password: string;
  createdAt: Date;
}

class UserStore {
  private static instance: UserStore;
  private users: Map<string, UserRecord> = new Map();

  private constructor() {}

  static getInstance(): UserStore {
    if (!UserStore.instance) {
      UserStore.instance = new UserStore();
    }
    return UserStore.instance;
  }

  createUser(username: string, password: string): UserRecord {
    if (this.findByUsername(username)) {
      throw new Error("User already exists");
    }

    const user: UserRecord = {
      id: crypto.randomUUID(),
      username,
      password,
      createdAt: new Date(),
    };

    this.users.set(user.id, user);
    return user;
  }

  findById(id: string): UserRecord | undefined {
    return this.users.get(id);
  }

  findByUsername(username: string): UserRecord | undefined {
    return [...this.users.values()].find((u) => u.username === username);
  }

  verifyUser(username: string, password: string): UserRecord | null {
    const user = this.findByUsername(username);
    if (!user || user.password !== password) {
      return null;
    }
    return user;
  }

  listUsers(): UserRecord[] {
    return [...this.users.values()];
  }
}

export const userStore = UserStore.getInstance();
export type { UserRecord };
