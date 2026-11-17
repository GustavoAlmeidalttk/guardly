import { Router } from 'express';
import * as testes from '../controllers/testesController.js';
import * as cenarios from '../controllers/cenariosController.js';
import * as execucoes from '../controllers/execucoesController.js';
import * as security from '../controllers/securityController.js';
import { asyncHandler } from '../middlewares/errors.js';
import { validateAnalysis } from '../middlewares/validateAnalysis.js';

export const router = Router();

router.get('/tests', asyncHandler(testes.index));
router.post('/tests', asyncHandler(testes.store));
router.get('/tests/:id', asyncHandler(testes.show));
router.get('/tests/:testId/scenarios', asyncHandler(cenarios.index));
router.post('/tests/:testId/scenarios', asyncHandler(cenarios.store));
router.get('/tests/:testId/scenarios/:scenarioId/executions', asyncHandler(execucoes.index));
router.post('/tests/:testId/scenarios/:scenarioId/executions', asyncHandler(execucoes.start));
router.patch('/tests/:testId/scenarios/:scenarioId/executions/:executionId', asyncHandler(execucoes.finish));
router.post('/security/analyze', validateAnalysis, asyncHandler(security.analyze));
