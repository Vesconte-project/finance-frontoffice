// Isolated component fixture only; no production route or authentication bypass.
const getToken = async () => null
export function useAuth() { return { isLoaded: true, getToken } }
