import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ClientPage({ params }: Props) {
  const { id } = await params;

  const { data: client, error } = await supabase
    .from("clients")
    .select(`
      *,
      properties (*)
    `)
    .eq("id", id)
    .single();

  if (error || !client) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-5xl">

        <Link
          href="/clients"
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Volver a clientes
        </Link>

        <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900">
            {client.first_name} {client.last_name}
          </h1>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-gray-500">Teléfono</p>
              <p className="font-medium">
                {client.phone || "No registrado"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium">
                {client.email || "No registrado"}
              </p>
            </div>
          </div>

          {client.general_notes && (
            <div className="mt-5">
              <p className="text-sm text-gray-500">Notas</p>
              <p className="mt-1">{client.general_notes}</p>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            Propiedades
          </h2>

          <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium">
            + Nueva propiedad
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {client.properties?.length === 0 && (
            <div className="rounded-xl bg-white p-6 text-gray-500">
              Este cliente todavía no tiene propiedades.
            </div>
          )}

          {client.properties?.map(
            (property: {
              id: string;
              property_name: string;
              address_line1: string;
              city: string | null;
              state: string | null;
              property_type: string | null;
              estimated_duration_minutes: number | null;
              usual_price: number | null;
            }) => (
              <div
                key={property.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-gray-900">
                  {property.property_name}
                </h3>

                <p className="mt-1 text-gray-600">
                  {property.address_line1}
                </p>

                <p className="text-gray-600">
                  {property.city}, {property.state}
                </p>

                <div className="mt-4 flex gap-6 text-sm">
                  <div>
                    <span className="text-gray-500">
                      Duración habitual
                    </span>

                    <p className="font-medium">
                      {property.estimated_duration_minutes
                        ? `${property.estimated_duration_minutes / 60} horas`
                        : "No definida"}
                    </p>
                  </div>

                  <div>
                    <span className="text-gray-500">
                      Precio habitual
                    </span>

                    <p className="font-medium">
                      {property.usual_price
                        ? `$${property.usual_price}`
                        : "No definido"}
                    </p>
                  </div>
                </div>
              </div>
            )
          )}
        </div>

      </div>
    </main>
  );
}