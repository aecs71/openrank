import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

export enum DifficultyLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

@Entity("keywords")
export class Keyword {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  keyword: string;

  @Column({ type: "int", nullable: true })
  difficulty: number; // 0-100 from DataForSEO

  @Column({
    type: "enum",
    enum: DifficultyLevel,
    nullable: true,
  })
  difficultyLevel: DifficultyLevel;

  @Column({ type: "int", nullable: true })
  searchVolume: number;

  @Column({ type: "float", nullable: true })
  kcv: number;

  @Column({ type: "jsonb", nullable: true })
  metadata: any; // Additional data from DataForSEO

  @CreateDateColumn()
  createdAt: Date;
}
