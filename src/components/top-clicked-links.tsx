import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Row = {
  url: string
  clicks: number
  unique_users: number
}

export function TopClickedLinks({ rows }: { rows: Row[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Clicked Links (Email)</CardTitle>
        <p className="text-sm text-neutral-500">
          From SendGrid click events. Unique users are distinct `user_id`.
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">
            No email clicks recorded yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="py-2 font-medium">URL</th>
                <th className="py-2 pr-2 text-right font-medium">Clicks</th>
                <th className="py-2 text-right font-medium">Unique</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.url} className="border-b last:border-0">
                  <td className="max-w-0 truncate py-2 pr-4 font-mono text-xs">
                    <span title={r.url}>{r.url}</span>
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {r.clicks.toLocaleString()}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {r.unique_users.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
