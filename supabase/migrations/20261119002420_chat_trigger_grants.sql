-- Trigger functions are not an API: nobody calls them through /rest/v1/rpc.
revoke all on function public._chat_on_group(), public._chat_on_group_member() from public, anon, authenticated;
