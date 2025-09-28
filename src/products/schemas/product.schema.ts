import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Category } from 'src/categories/schemas/category.schema';

@Schema({ timestamps: true })
export class Product extends Document {
	@Prop({ required: true, unique: true, trim: true, uppercase: true })
	code: string;

	@Prop({ required: true, trim: true })
	name: string;

	@Prop({ type: [{ type: Types.ObjectId, ref: Category.name }] })
	// relación N a N: un producto puede estar en varias categorías
	categories: Types.ObjectId[]; 

	@Prop({ required: true })
	price: number;

	@Prop()
	img_url?: string;

	/*
	@Prop({ type: [{ type: Types.ObjectId, ref: Stock.name }] })
	stock: Types.ObjectId;

	@Prop({ type: [{ type: Types.ObjectId, ref: Valoration.name }] })
	valorations?: Types.ObjectId[];
	*/
}

export const ProductSchema = SchemaFactory.createForClass(Product);
