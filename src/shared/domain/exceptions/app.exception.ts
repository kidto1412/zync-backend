export class AppException extends Error {
  constructor(message: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class RoomNotFoundException extends AppException {
  constructor(pin: string) {
    super(`Pairing room with PIN ${pin} does not exist or has expired`, 404);
  }
}

export class RoomFullException extends AppException {
  constructor() {
    super(`Pairing room is already full (maximum 2 devices per session)`, 409);
  }
}
