import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true })
export class Product {
	@Prop({ required: true, unique: true, trim: true, uppercase: true })
	code: string;

	@Prop({ required: true, trim: true })
	name: string;

	@Prop({ type: [{ type: Types.ObjectId, ref: 'Category' }] })
	// relación N a N: un producto puede estar en varias categorías
	categories: Types.ObjectId[];

	@Prop({ required: true })
	price: number;

	@Prop()
	img_url?: string;

	@Prop({ type: [{ type: Types.ObjectId, ref: 'Stock' }] })
	stock: Types.ObjectId;
	/*
	@Prop({ type: [{ type: Types.ObjectId, ref: ProductValoration.name }] })
	valorations?: Types.ObjectId[];
	*/

	@Prop({ type: Number, min: 0, max: 5, default: 0 })
	rating?: number;         

	@Prop({ type: Number, min: 0, default: 0 })
	ratingCount?: number;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
