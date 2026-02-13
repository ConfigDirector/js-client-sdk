export const djb2Hash = (data: string): string => {
  const hash = djb2(new TextEncoder().encode(data));
	return hash.toString(16).padStart(8, "0");
};

const djb2 = (bytes: Uint8Array): number => {
    let hash = 5381;
		for (let i = 0; i < bytes.length; i++) {
			hash = ((hash << 5) + hash) + bytes[i];
			hash = hash >>> 0;
		}
    return hash;
};
