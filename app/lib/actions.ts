"use server";

import { sql } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(["pending", "paid"]),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
  try {
    const { customerId, amount, status } = CreateInvoice.parse(
      Object.fromEntries(formData.entries())
    );

    const amountInCents = amount * 100;
    const date = new Date().toISOString().split("T")[0];

    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date});
    `;
  } catch (error) {
    console.error(error);
    return { message: "Failed to create the invoice" };
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function updateInvoice(invoiceId: string, formData: FormData) {
  try {
    const { customerId, amount, status } = UpdateInvoice.parse(
      Object.fromEntries(formData.entries())
    );

    const amountInCents = amount * 100;

    await sql`
      UPDATE invoices SET
        customer_id = ${customerId},
        amount = ${amountInCents},
        status = ${status}
      WHERE id = ${invoiceId};
    `;
  } catch (error) {
    console.error(error);
    return { message: "Failed to update the invoice" };
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function deleteInvoice(invoiceId: string) {
  try {
    await sql`
      DELETE FROM invoices
      WHERE id = ${invoiceId};
    `;

    revalidatePath("/dashboard/invoices");
    return { message: "Deleted Invoice" };
  } catch (error) {
    console.error(error);
    return { message: "Failed to delete the invoice" };
  }
}
