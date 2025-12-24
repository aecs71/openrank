import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Draft } from './draft.entity';

@Entity('sections')
export class Section {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  draftId: string;

  @ManyToOne(() => Draft, (draft) => draft.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'draftId' })
  draft: Draft;

  @Column({ type: 'varchar', length: 255 })
  heading: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'int' })
  order: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  type: string; // 'introduction', 'section', 'conclusion'

  @CreateDateColumn()
  createdAt: Date;
}

