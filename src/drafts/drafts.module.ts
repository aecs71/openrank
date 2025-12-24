import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { DraftsController } from './drafts.controller';
import { DraftsService } from './drafts.service';
import { Draft } from './entities/draft.entity';
import { Section } from './entities/section.entity';
import { KeywordsModule } from '../keywords/keywords.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Draft, Section]),
    BullModule.registerQueue(
      { name: 'strategy' },
      { name: 'outline' },
      { name: 'content' },
    ),
    KeywordsModule,
  ],
  controllers: [DraftsController],
  providers: [DraftsService],
  exports: [DraftsService],
})
export class DraftsModule {}

