export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly name?: string,
    public readonly plan: 'FREE' | 'PRO_LIFETIME' = 'FREE',
    public readonly licenseKey?: string,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {}
}
