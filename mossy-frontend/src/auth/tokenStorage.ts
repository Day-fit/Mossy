let accessToken: string | null = null;

export const tokenStorage = {
    get: () => accessToken,
    set: (token: string | null) => {
        accessToken = token;
    }
};
