import { ApiProperty } from '@nestjs/swagger';

/** Response shape for cursor-paginated list endpoints — goes inside the `data` envelope field. */
export class CursorPage<T> {
  @ApiProperty({ isArray: true })
  items: T[];

  @ApiProperty({ required: false, nullable: true })
  nextCursor?: string;

  constructor(items: T[], nextCursor?: string) {
    this.items = items;
    this.nextCursor = nextCursor;
  }
}
