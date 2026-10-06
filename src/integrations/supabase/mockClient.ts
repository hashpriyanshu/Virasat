// Local Offline Mock Supabase Client
// Enables the Virasat application to function seamlessly with local storage persistence
// when a cloud Supabase project is not connected, expired, or unreachable.

type AuthListener = (event: string, session: any) => void;

class MockAuth {
  private listeners: Set<AuthListener> = new Set();

  private getUsers(): any[] {
    try {
      const data = localStorage.getItem('virasat_mock_users');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveUsers(users: any[]) {
    try {
      localStorage.setItem('virasat_mock_users', JSON.stringify(users));
    } catch (e) {
      console.error('Failed to save mock users', e);
    }
  }

  private getSessionData(): any {
    try {
      const data = localStorage.getItem('virasat_mock_session');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private setSessionData(session: any) {
    try {
      if (session) {
        localStorage.setItem('virasat_mock_session', JSON.stringify(session));
        localStorage.setItem('virasat_mock_user', JSON.stringify(session.user));
      } else {
        localStorage.removeItem('virasat_mock_session');
        localStorage.removeItem('virasat_mock_user');
      }
    } catch (e) {
      console.error('Failed to save session data', e);
    }
  }

  private notify(event: string, session: any) {
    this.listeners.forEach((listener) => {
      try {
        listener(event, session);
      } catch (err) {
        console.error('Error in auth listener:', err);
      }
    });
  }

  async signUp({ email, password, options }: { email: string; password: string; options?: any }) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const users = this.getUsers();
    const existing = users.find(u => u.email.toLowerCase() === normalizedEmail);

    if (existing) {
      return {
        data: { user: null, session: null },
        error: { message: 'User already registered' }
      };
    }

    const userId = 'usr_' + Math.random().toString(36).substring(2, 11);
    const user = {
      id: userId,
      email: normalizedEmail,
      user_metadata: options?.data || {},
      created_at: new Date().toISOString()
    };

    users.push({
      ...user,
      password // Stored in localStorage for offline mock login verification
    });
    this.saveUsers(users);

    const session = {
      access_token: 'mock_jwt_' + Math.random().toString(36).substring(2),
      token_type: 'bearer',
      user,
      expires_at: Math.floor(Date.now() / 1000) + 86400 * 30
    };

    this.setSessionData(session);

    // Auto-create profile in profiles table
    try {
      const profilesKey = 'virasat_db_profiles';
      const existingProfiles = JSON.parse(localStorage.getItem(profilesKey) || '[]');
      existingProfiles.push({
        id: 'prof_' + Math.random().toString(36).substring(2, 9),
        user_id: userId,
        email: normalizedEmail,
        full_name: options?.data?.full_name || '',
        phone: options?.data?.phone || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      localStorage.setItem(profilesKey, JSON.stringify(existingProfiles));
    } catch (e) {
      console.warn('Failed to insert default profile', e);
    }

    this.notify('SIGNED_IN', session);

    return {
      data: { user, session },
      error: null
    };
  }

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const users = this.getUsers();
    let userRecord = users.find(u => u.email.toLowerCase() === normalizedEmail);

    // If no users exist yet in mock store, auto-register this user so they can test immediately
    if (!userRecord && users.length === 0) {
      return this.signUp({ email, password, options: { data: { full_name: 'Demo User' } } });
    }

    if (!userRecord) {
      return {
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' }
      };
    }

    if (userRecord.password !== password) {
      return {
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' }
      };
    }

    const { password: _, ...user } = userRecord;
    const session = {
      access_token: 'mock_jwt_' + Math.random().toString(36).substring(2),
      token_type: 'bearer',
      user,
      expires_at: Math.floor(Date.now() / 1000) + 86400 * 30
    };

    this.setSessionData(session);
    this.notify('SIGNED_IN', session);

    return {
      data: { user, session },
      error: null
    };
  }

  async signInWithOAuth({ provider, options }: { provider: string; options?: any }) {
    const userId = 'usr_oauth_' + Math.random().toString(36).substring(2, 9);
    const user = {
      id: userId,
      email: `${provider}_user@virasat.local`,
      user_metadata: { full_name: `${provider.toUpperCase()} User` },
      created_at: new Date().toISOString()
    };
    const session = {
      access_token: 'mock_oauth_jwt_' + Math.random().toString(36).substring(2),
      token_type: 'bearer',
      user,
      expires_at: Math.floor(Date.now() / 1000) + 86400 * 30
    };

    this.setSessionData(session);
    this.notify('SIGNED_IN', session);

    if (options?.redirectTo) {
      window.location.href = options.redirectTo;
    }

    return { data: { provider, url: options?.redirectTo || '/dashboard' }, error: null };
  }

  async signOut() {
    this.setSessionData(null);
    this.notify('SIGNED_OUT', null);
    return { error: null };
  }

  async getUser() {
    const session = this.getSessionData();
    return {
      data: { user: session?.user || null },
      error: null
    };
  }

  async getSession() {
    const session = this.getSessionData();
    return {
      data: { session },
      error: null
    };
  }

  onAuthStateChange(callback: AuthListener) {
    this.listeners.add(callback);
    const session = this.getSessionData();
    if (session) {
      setTimeout(() => callback('SIGNED_IN', session), 0);
    }
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners.delete(callback);
          }
        }
      }
    };
  }

  async resetPasswordForEmail(email: string, options?: any) {
    return { data: {}, error: null };
  }
}

class MockQueryBuilder {
  private tableName: string;
  private filters: Array<(row: any) => boolean> = [];
  private orderField: string | null = null;
  private orderAscending: boolean = true;
  private isSingle: boolean = false;
  private headOnly: boolean = false;
  private countMode: string | null = null;
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any = null;

  constructor(table: string) {
    this.tableName = table;
  }

  private getRows(): any[] {
    try {
      const data = localStorage.getItem('virasat_db_' + this.tableName);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveRows(rows: any[]) {
    try {
      localStorage.setItem('virasat_db_' + this.tableName, JSON.stringify(rows));
    } catch (e) {
      console.error('Failed to save rows to ' + this.tableName, e);
    }
  }

  select(columns: string = '*', options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
    if (options?.head) this.headOnly = true;
    if (options?.count) this.countMode = options.count;
    return this;
  }

  insert(data: any | any[]) {
    this.action = 'insert';
    this.payload = data;
    return this;
  }

  update(data: any) {
    this.action = 'update';
    this.payload = data;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((row: any) => {
      if (!row) return false;
      return String(row[column]) === String(value);
    });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((row: any) => {
      if (!row) return false;
      return String(row[column]) !== String(value);
    });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderField = column;
    this.orderAscending = options?.ascending !== false;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  limit(count: number) {
    return this;
  }

  private execute() {
    const rows = this.getRows();

    if (this.action === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = items.map((item, idx) => ({
        id: item.id || Date.now() + idx,
        created_at: item.created_at || new Date().toISOString(),
        ...item
      }));
      const nextRows = [...inserted, ...rows];
      this.saveRows(nextRows);

      const resultData = Array.isArray(this.payload) ? inserted : inserted[0];
      return {
        data: this.isSingle ? inserted[0] : resultData,
        error: null,
        count: inserted.length
      };
    }

    if (this.action === 'update') {
      let updatedCount = 0;
      let lastUpdated: any = null;
      const nextRows = rows.map(row => {
        const matches = this.filters.every(fn => fn(row));
        if (matches) {
          updatedCount++;
          const updated = { ...row, ...this.payload, updated_at: new Date().toISOString() };
          lastUpdated = updated;
          return updated;
        }
        return row;
      });
      this.saveRows(nextRows);

      return {
        data: this.isSingle ? lastUpdated : (lastUpdated ? [lastUpdated] : []),
        error: null,
        count: updatedCount
      };
    }

    if (this.action === 'delete') {
      const remaining = rows.filter(row => !this.filters.every(fn => fn(row)));
      this.saveRows(remaining);
      return {
        data: null,
        error: null,
        count: rows.length - remaining.length
      };
    }

    // Default: 'select'
    let filtered = rows.filter(row => this.filters.every(fn => fn(row)));

    if (this.orderField) {
      const field = this.orderField;
      const asc = this.orderAscending;
      filtered.sort((a, b) => {
        if (a[field] < b[field]) return asc ? -1 : 1;
        if (a[field] > b[field]) return asc ? 1 : -1;
        return 0;
      });
    }

    const totalCount = filtered.length;

    if (this.headOnly) {
      return {
        data: null,
        error: null,
        count: totalCount
      };
    }

    if (this.isSingle) {
      if (filtered.length === 0) {
        return {
          data: null,
          error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
          count: 0
        };
      }
      return {
        data: filtered[0],
        error: null,
        count: 1
      };
    }

    return {
      data: filtered,
      error: null,
      count: totalCount
    };
  }

  then(resolve: (value: any) => any, reject?: (reason: any) => any) {
    try {
      const res = this.execute();
      return Promise.resolve(res).then(resolve, reject);
    } catch (err) {
      if (reject) return Promise.reject(err).catch(reject);
      return Promise.reject(err);
    }
  }
}

class MockStorageBucket {
  private bucket: string;

  constructor(bucket: string) {
    this.bucket = bucket;
  }

  private getFiles(): any[] {
    try {
      const data = localStorage.getItem('virasat_storage_' + this.bucket);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveFiles(files: any[]) {
    try {
      localStorage.setItem('virasat_storage_' + this.bucket, JSON.stringify(files));
    } catch (e) {
      console.error('Failed to save mock storage files', e);
    }
  }

  async list(path: string = '', options?: { limit?: number; offset?: number }) {
    const files = this.getFiles();
    const prefix = path ? (path.endsWith('/') ? path : path + '/') : '';
    const filtered = files.filter(f => !prefix || f.file_path.startsWith(prefix) || f.file_path.startsWith(path));
    return { data: filtered, error: null };
  }

  async upload(filePath: string, file: File | Blob) {
    const files = this.getFiles();
    const fileName = filePath.split('/').pop() || 'file';
    const newFile = {
      id: 'doc_' + Math.random().toString(36).substring(2, 9),
      name: fileName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      file_path: filePath,
      metadata: {
        size: file.size,
        mimetype: file.type || 'application/octet-stream'
      }
    };
    files.push(newFile);
    this.saveFiles(files);
    return { data: { path: filePath }, error: null };
  }

  async download(filePath: string) {
    const dummyBlob = new Blob(['Virasat Secure Vault Sample Document'], { type: 'application/pdf' });
    return { data: dummyBlob, error: null };
  }

  async createSignedUrl(filePath: string, expiresIn: number) {
    return { data: { signedUrl: '#' }, error: null };
  }

  getPublicUrl(filePath: string) {
    return { data: { publicUrl: '#' } };
  }

  async remove(paths: string[]) {
    const files = this.getFiles().filter(f => !paths.includes(f.file_path));
    this.saveFiles(files);
    return { data: paths, error: null };
  }
}

export function createMockSupabaseClient() {
  const auth = new MockAuth();

  return {
    auth,
    from: (table: string) => new MockQueryBuilder(table),
    storage: {
      from: (bucket: string) => new MockStorageBucket(bucket)
    }
  };
}
