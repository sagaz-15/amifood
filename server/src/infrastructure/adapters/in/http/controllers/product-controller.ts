import type { Request, Response } from 'express';
import type { ProductUseCases } from '../../../../../application/ports/in/product-use-cases.ts';
import type {
  CreateProductCommand,
  ListProductsQuery,
  UpdateProductCommand,
} from '../../../../../application/dto/product-dto.ts';
import { currentAccount } from '../middleware/authentication-middleware.ts';
import {
  presentPriceChange,
  presentProduct,
  presentProductDetail,
  presentProductListItem,
} from '../presenters/product-presenter.ts';
import type { SseProductNotifier } from '../sse/sse-product-notifier.ts';

interface IdParams {
  id: string;
}

interface AvailabilityBody {
  isAvailable: boolean;
}

interface PriceBody {
  price: number;
  reason?: string | null;
}

interface StockBody {
  delta: number;
  reason?: string | null;
}

/**
 * ADAPTADOR DE ENTRADA HTTP. Solo traduce HTTP <-> casos de uso.
 * No contiene reglas de negocio ni SQL (SRP).
 */
export class ProductController {
  private readonly useCases: ProductUseCases;
  private readonly notifier: SseProductNotifier;

  constructor(useCases: ProductUseCases, notifier: SseProductNotifier) {
    this.useCases = useCases;
    this.notifier = notifier;
  }

  list = async (req: Request, res: Response): Promise<void> => {
    const query = res.locals.validated.query as ListProductsQuery;
    const page = await this.useCases.list(query);
    res.status(200).json({
      data: page.items.map(presentProductListItem),
      meta: {
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
        totalPages: page.totalPages,
      },
    });
  };

  listMine = async (req: Request, res: Response): Promise<void> => {
    const page = await this.useCases.listMine(currentAccount(res));
    res.status(200).json({
      data: page.items.map(presentProductListItem),
      meta: {
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
        totalPages: page.totalPages,
      },
    });
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const { id } = res.locals.validated.params as IdParams;
    const detail = await this.useCases.getById(id);
    res.status(200).json({ data: presentProductDetail(detail) });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const command = res.locals.validated.body as CreateProductCommand;
    const product = await this.useCases.create(currentAccount(res), command);
    res
      .status(201)
      .location(`/api/v1/products/${product.id}`)
      .json({ data: presentProduct(product) });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = res.locals.validated.params as IdParams;
    const command = res.locals.validated.body as UpdateProductCommand;
    const product = await this.useCases.update(currentAccount(res), id, command);
    res.status(200).json({ data: presentProduct(product) });
  };

  setAvailability = async (req: Request, res: Response): Promise<void> => {
    const { id } = res.locals.validated.params as IdParams;
    const { isAvailable } = res.locals.validated.body as AvailabilityBody;
    const product = await this.useCases.setAvailability(currentAccount(res), id, isAvailable);
    res.status(200).json({ data: presentProduct(product) });
  };

  changePrice = async (req: Request, res: Response): Promise<void> => {
    const { id } = res.locals.validated.params as IdParams;
    const { price, reason } = res.locals.validated.body as PriceBody;
    const product = await this.useCases.changePrice(currentAccount(res), id, price, reason);
    res.status(200).json({ data: presentProduct(product) });
  };

  adjustStock = async (req: Request, res: Response): Promise<void> => {
    const { id } = res.locals.validated.params as IdParams;
    const { delta, reason } = res.locals.validated.body as StockBody;
    const product = await this.useCases.adjustStock(currentAccount(res), id, delta, reason);
    res.status(200).json({ data: presentProduct(product) });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = res.locals.validated.params as IdParams;
    await this.useCases.delete(currentAccount(res), id);
    res.status(204).send();
  };

  priceHistory = async (req: Request, res: Response): Promise<void> => {
    const { id } = res.locals.validated.params as IdParams;
    const history = await this.useCases.getPriceHistory(currentAccount(res), id);
    res.status(200).json({ data: history.map(presentPriceChange) });
  };

  streamEvents = (req: Request, res: Response): void => {
    this.notifier.attach(req, res);
  };
}
