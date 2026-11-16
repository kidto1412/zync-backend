export class VaultEntry {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly sourceDevice: string,
    public readonly contentType: string,
    public readonly encryptedData: string,
    public readonly iv: string,
    public readonly byteSize: number,
    public readonly expiresAt: Date,
    public readonly createdAt: Date = new Date()
  ) {}
}
