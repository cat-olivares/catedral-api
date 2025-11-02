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
}

export const ProductSchema = SchemaFactory.createForClass(Product);
