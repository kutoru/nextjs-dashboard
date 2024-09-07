"use server";

import { signIn } from "@/auth";
import { sql } from "@vercel/postgres";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    required_error: "Select a customer",
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: "Enter an amount greater than 0" }),
  status: z.enum(["pending", "paid"], {
    required_error: "Select an invoice status",
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
  message?: string | null;
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
};

export async function createInvoice(_prevState: State, formData: FormData) {
  const validatedFields = CreateInvoice.safeParse(
    Object.fromEntries(formData.entries())
  );

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing fields. Failed to create the invoice.",
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split("T")[0];

  try {
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

export async function updateInvoice(
  invoiceId: string,
  _prevState: State,
  formData: FormData
) {
  const validatedFields = UpdateInvoice.safeParse(
    Object.fromEntries(formData.entries())
  );

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing fields. Failed to update the invoice.",
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;

  try {
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
  } catch (error) {
    console.error(error);
    return { message: "Failed to delete the invoice" };
  }

  revalidatePath("/dashboard/invoices");
  return { message: "Deleted Invoice" };
}

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData
) {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid credentials.";
        default:
          return "Something went wrong.";
      }
    }

    throw error;
  }
}
