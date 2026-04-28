const TOKEN_KEY = 'mossy_access_token';

export const tokenStorage = {
  get: async (): Promise<string | null> => {
    const result = await chrome.storage.session.get(TOKEN_KEY);
    return (result[TOKEN_KEY] as string | undefined) ?? null;
  },
  set: async (token: string | null): Promise<void> => {
    if (token === null) {
      await chrome.storage.session.remove(TOKEN_KEY);
      return;
    }
    await chrome.storage.session.set({ [TOKEN_KEY]: token });
  },
};
