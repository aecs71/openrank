import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Draft, DraftStatus } from "./entities/draft.entity";
import { Section } from "./entities/section.entity";
import { KeywordsService } from "../keywords/keywords.service";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { KeywordsModule } from "../keywords/keywords.module";

@Injectable()
export class DraftsService {
  private readonly logger = new Logger(DraftsService.name);

  constructor(
    @InjectRepository(Draft)
    private draftRepository: Repository<Draft>,
    @InjectRepository(Section)
    private sectionRepository: Repository<Section>,
    private keywordsService: KeywordsService,
    @InjectQueue("strategy") private strategyQueue: Queue,
    @InjectQueue("outline") private outlineQueue: Queue,
    @InjectQueue("content") private contentQueue: Queue
  ) {}

  /**
   * Create a draft with selected keyword
   */
  async createDraft(keywordId: string): Promise<Draft> {
    const keyword = await this.keywordsService.findById(keywordId);
    if (!keyword) {
      throw new Error(`Keyword with ID ${keywordId} not found`);
    }

    const draft = this.draftRepository.create({
      title: keyword.keyword,
      primaryKeywordId: keywordId,
      status: DraftStatus.RESEARCHING,
    });

    const savedDraft = await this.draftRepository.save(draft);

    // Trigger strategy analysis
    await this.strategyQueue.add("analyze-strategy", {
      draftId: savedDraft.id,
      keyword: keyword.keyword,
    });

    this.logger.log(
      `Created draft ${savedDraft.id} for keyword: ${keyword.keyword}`
    );
    return savedDraft;
  }

  /**
   * Find draft by ID
   */
  async findById(id: string): Promise<Draft | null> {
    return await this.draftRepository.findOne({
      where: { id },
      relations: ["primaryKeyword", "sections"],
    });
  }

  /**
   * Update draft status
   */
  async updateStatus(id: string, status: DraftStatus): Promise<Draft> {
    const draft = await this.findById(id);
    if (!draft) {
      throw new Error(`Draft with ID ${id} not found`);
    }

    draft.status = status;
    return await this.draftRepository.save(draft);
  }

  /**
   * Update draft strategy
   */
  async updateStrategy(id: string, strategy: any): Promise<Draft> {
    const draft = await this.findById(id);
    if (!draft) {
      throw new Error(`Draft with ID ${id} not found`);
    }

    draft.strategy = strategy;
    draft.status = DraftStatus.OUTLINE_PENDING;
    const savedDraft = await this.draftRepository.save(draft);

    // Trigger outline generation
    const keyword = draft.primaryKeyword?.keyword || "";
    await this.outlineQueue.add("generate-outline", {
      draftId: id,
      keyword,
      strategy,
    });

    return savedDraft;
  }

  /**
   * Update draft outline
   */
  async updateOutline(id: string, outline: any): Promise<Draft> {
    const draft = await this.findById(id);
    if (!draft) {
      throw new Error(`Draft with ID ${id} not found`);
    }

    draft.outline = outline;
    return await this.draftRepository.save(draft);
  }

  /**
   * Approve outline and trigger content generation
   */
  async approveOutline(id: string): Promise<Draft> {
    const draft = await this.findById(id);
    if (!draft) {
      throw new Error(`Draft with ID ${id} not found`);
    }

    if (!draft.outline) {
      throw new Error("Draft has no outline to approve");
    }

    draft.status = DraftStatus.OUTLINE_APPROVED;

    // Trigger content generation
    await this.contentQueue.add("generate-content", {
      draftId: id,
      outline: draft.outline,
      strategy: draft.strategy,
    });

    return await this.draftRepository.save(draft);
  }

  /**
   * Append content to draft
   */
  async appendContent(
    draftId: string,
    content: string,
    sectionTitle: string,
    order: number,
    type: string
  ): Promise<Section> {
    const section = this.sectionRepository.create({
      draftId,
      heading: sectionTitle,
      content,
      order,
      type,
    });

    return await this.sectionRepository.save(section);
  }

  /**
   * Update draft final content
   */
  async updateContent(id: string, content: string): Promise<Draft> {
    const draft = await this.findById(id);
    if (!draft) {
      throw new Error(`Draft with ID ${id} not found`);
    }

    draft.content = content;
    draft.status = DraftStatus.COMPLETED;
    return await this.draftRepository.save(draft);
  }

  /**
   * Update SEO score
   */
  async updateSeoScore(id: string, seoScore: any): Promise<Draft> {
    const draft = await this.findById(id);
    if (!draft) {
      throw new Error(`Draft with ID ${id} not found`);
    }

    draft.seoScore = seoScore;
    return await this.draftRepository.save(draft);
  }

  /**
   * Get all drafts
   */
  async findAll(): Promise<Draft[]> {
    return await this.draftRepository.find({
      relations: ["primaryKeyword"],
      order: { createdAt: "DESC" },
    });
  }
}
