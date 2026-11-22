Create party

List parties with pagination and search

View individual party

Update party details

Activate/deactivate party

Store contact and address information

Track opening balances and party balances later through transactions

to fix later

1.One small issue to fix later
Your pagination response currently returns:
{
"page": "1",
"limit": "20"
}

These should be numbers, not strings:
{
"page": 1,
"limit": 20
}

We'll correct that as part of validation and query handling.

2.Test Get http://localhost:5000/api/inventory/
