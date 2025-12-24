import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { StrategyProcessor } from "./strategy.processor";
import { OutlineProcessor } from "./outline.processor";
import { ContentProcessor } from "./content.processor";
import { DraftsModule } from "../drafts/drafts.module";
import { ServicesModule } from "../services/services.module";

@Module({
  imports: [
    BullModule.registerQueue(
      { name: "strategy" },
      { name: "outline" },
      { name: "content" }
    ),
    DraftsModule,
    ServicesModule,
  ],
  providers: [StrategyProcessor, OutlineProcessor, ContentProcessor],
})
export class WorkersModule {}
