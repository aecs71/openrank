import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Section } from './section.entity';
import { Keyword } from '../../keywords/entities/keyword.entity';

export enum DraftStatus {
  RESEARCHING = 'RESEARCHING',
  ANALYZING = 'ANALYZING',
  OUTLINE_PENDING = 'OUTLINE_PENDING',
  OUTLINE_APPROVED = 'OUTLINE_APPROVED',
  WRITING = 'WRITING',
  COMPLETED = 'COMPLETED',
}

// Re-export for convenience
export { DraftStatus as DraftStatusEnum };

@Entity('drafts')
export class Draft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({
    type: 'enum',
    enum: DraftStatus,
    default: DraftStatus.RESEARCHING,
  })
  status: DraftStatus;

  @Column({ type: 'uuid', nullable: true })
  primaryKeywordId: string;

  @OneToOne(() => Keyword, { nullable: true })
  @JoinColumn({ name: 'primaryKeywordId' })
  primaryKeyword: Keyword;

  @Column({ type: 'jsonb', nullable: true })
  strategy: {
    targetFormat?: string;
    informationGainAngle?: string;
    competitorHeadings?: string[];
    serpData?: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  outline: {
    title: string;
    sections: Array<{
      heading: string;
      intent: string;
      keywordsToInclude: string[];
    }>;
  };

  @Column({ type: 'jsonb', nullable: true })
  seoScore: {
    keywordInH1: boolean;
    keywordInFirstParagraph: boolean;
    keywordInH2: boolean;
    entityDensity: number;
    wordCount: number;
  };

  @OneToMany(() => Section, (section) => section.draft, { cascade: true })
  sections: Section[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

