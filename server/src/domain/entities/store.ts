export interface Store {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly imageUrl: string | null;
  readonly isActive: boolean;
}
