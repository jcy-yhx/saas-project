import type { Request, Response, NextFunction } from 'express';
import { searchQuerySchema } from '@taskflow/shared';
import * as searchService from '../services/search.service.js';

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const query = searchQuerySchema.parse(req.query);
    const result = await searchService.search(query);
    res.json({ data: result.tasks, meta: result.meta });
  } catch (err) { next(err); }
}
