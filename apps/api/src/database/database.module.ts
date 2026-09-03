import { Global, Module, OnModuleDestroy } from "@nestjs/common";
import { closeDb, getDb } from "./client";

export const DATABASE = "DATABASE";

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: () => getDb(),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnModuleDestroy {
  async onModuleDestroy() {
    await closeDb();
  }
}
