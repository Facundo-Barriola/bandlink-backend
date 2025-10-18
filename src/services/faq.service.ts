// src/services/faq.service.ts
import { listFaqs as repoListFaqs } from "../repositories/faq.repository.js";

export const FaqService = {
  async listFaqs(groupMask: number, opts?: { q?: string }) {
    return repoListFaqs(groupMask, opts);
  },
};
