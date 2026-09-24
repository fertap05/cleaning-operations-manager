import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default async function ClientsPage() {
  const { data: clients, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Error</h1>
        <p className="mt-2 text-red-600">{error.message}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-5xl">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Clientes
            </h1>

            <p className="mt-1 text-gray-600">
              Administra clientes y sus propiedades
            </p>
          </div>

          <button className="rounded-lg bg-gray-900 px-4 py-2 text-white">
            + Nuevo cliente
          </button>
        </div>

        <div className="mt-8 space-y-4">
          {clients?.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <h2 className="text-xl font-semibold text-gray-900">
                {client.first_name} {client.last_name}
              </h2>

              <p className="mt-1 text-gray-600">
                {client.phone || "Sin teléfono"}
              </p>

              <p className="mt-3 text-sm font-medium text-gray-500">
                Ver cliente →
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}