# Meet Malloy

Malloy is an experimental language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database. Malloy is currently available on BigQuery and Postgres. About Malloy:

- Queries compile to SQL, optimized for your database
- Computations are modular, composable, reusable, and extendable in ways that are consistent with modern programming paradigms
- Excels at querying and producing nested data sets
- The fan and chasm traps are solved, making it possible to aggregate anything in one query and reducing need for fact tables and overly complex SQL
- Defaults are smart, and the language is concise (where SQL is verbose and often redundant)

Malloy is a language for anyone who works with SQL--whether you’re an analyst, data scientist, data engineer, or someone building a data application. If you know SQL, Malloy will feel familiar, while more powerful and efficient. Malloy allows you to model as you go, so there is no heavy up-front work before you can start answering complex questions, and you're never held back or restricted by the model.

We've built a Visual Studio Code extension to facilitate interacting with your data using Malloy. The extension provides a rich environment to create Malloy data models, query and transform data, and to create simple visualizations and dashboards.

# Syntax Example
Here's a SQL query one might write to answer "What flights were available from SFO to JFK/EWR in the year 2003," along with a bit of information that might help compare options.

```sql
SELECT
    carrier
    , flight_num
    , destination
    , COUNT(1) AS flight_count
    , ROUND(AVG(flight_time),1) as average_flight_time
    , ROUND(AVG(dep_delay),1) AS average_delay
FROM `malloy-data.faa.flights` AS flights
WHERE origin = 'SFO'
    AND (destination = 'JFK' OR destination = 'EWR')
    AND (dep_time>='2003-01-01')
    AND (dep_time<'2004-01-01')
GROUP BY carrier, flight_num, destination
ORDER BY flight_count DESC
```

In Malloy, this would be expressed:
```malloy
query: table('malloy-data.faa.flights') -> {   -- start with the source
  top: 20 by flight_count               -- `by flight_count` is optional here; Malloy automatically orders by your first measure, desc
  where: [
    origin: 'SFO'
    , destination: 'JFK' | 'EWR'        -- the 'apply' operator means less repeating yourself
    , dep_time: @2003                   -- easy handling of time/dates
  ]
  group_by: [                           -- no need to write non-aggregates in both SELECT and GROUP BY clause
    carrier
    , flight_num
    , destination
  ]
  aggregate: [
    flight_count is count()
    average_flight_time is round(avg(flight_time),1)    -- in Malloy, we always start with the name of a field, table, etc. to improve readability
    , average_delay is round(avg(dep_delay))            -- most familiar SQL expressions are supported
  ]
}
```

We think that the querying experience alone improves upon SQL substantially. But where Malloy really shines is as you begin building out a data model. Let's expand upon the prior SQL example by adding some joins to access prettier names.

```sql
SELECT
    carriers.nickname
    , flights.flight_num
    , destination.full_name
    , destination.city
    , ROUND(AVG(flight_time),1) as average_flight_time
    , COUNT(1) AS flight_count
    , ROUND(AVG(dep_delay),1) AS average_delay
FROM `malloy-data.faa.flights` AS flights
LEFT JOIN `malloy-data.faa.carriers` AS carriers
    ON flights.carrier = carriers.code
LEFT JOIN `malloy-data.faa.airports` AS destination
    ON flights.destination = destination.code
WHERE flights.origin = 'SFO'
    AND (flights.destination = 'JFK' OR flights.destination = 'EWR')
    AND (flights.dep_time>='2003-01-01')
    AND (flights.dep_time<'2004-01-01')
GROUP BY carriers.nickname, flights.flight_num, destination.full_name, destination.city
ORDER BY average_flight_time ASC
```

Here's how we expect one might start working the reusable pieces into a Malloy model. N ote that there's no up-front need to model anything--you can model as you go to make your analysis more efficient over time:

```malloy
explore: carriers is table('malloy-data.faa.carriers'){
  primary_key: code       -- we declare primary keys to let malloy solve the fan/chasm traps, calculating aggregates correctly anywhere
}

explore: airports is table('malloy-data.faa.airports'){
  primary_key: code
}

explore: flights is table('malloy-data.faa.flights'){
  join_one: carriers with carrier         -- for this join of many flights to one carrier, malloy only needs the key from flights and uses the primary key from carriers.
  join_one: destinations is airports with destination
  measure: [
    flight_count is count()
    average_flight_time is round(avg(flight_time),1)    -- in Malloy, we always start with the name of a field, table, etc. to improve readability
    average_delay is round(avg(dep_delay))
  ]

  query: best_flights is {      -- define a common query of the best flights, we can filter/refine this when we reference it
    top: 20 by flight_count
    group_by: [
      carriers.nickname
      , flight_num
      , destinations.full_name
    ]
    aggregate: [
      flight_count        -- no need to re-define, this is in our explore now
      average_flight_time
      , average_delay
    ]
  }
}

query: flights -> best_flights {      -- starting with the flights explore, refine best_flights for our specific question
  where: [
    origin: 'SFO'
    , destination: 'JFK' | 'EWR'        -- the 'apply' operator means less repeating yourself
    , dep_time: @2003
  ]
}

```

So now when we instead want to ask, "What were the best flights from SFO to anywhere in the state of Colorado in January of any year?" you'd simply write:

```
query: flights -> best_flights {      -- starting with the flights explore, refine best_flights for our specific question
  where: [
    origin: 'SFO'
    , destinations.state: 'CO'        -- the 'apply' operator means less repeating yourself
    , month(dep_time): 1
  ]
}
```



# Installing the Extension

Currently, the Malloy extension works on Mac and Linux machines.

## 1. Download Visual Studio Code

If you don't already have it, download [Visual Studio Code](https://code.visualstudio.com/)

## 2. Add the Malloy extension from the Visual Studio Code Marketplace

Open VS Code and click the Extensions button on the far left (it looks like 4 blocks with one flying away). This will open the Extension Marketplace. Search for "Malloy" and, once found, click "Install"

## 3. Open the Malloy extension and connect to your database

Click on the Malloy icon on the left side of VS Code. This opens the Malloy view - a view that allows you to view schemas as you work with Malloy models and edit database connections.

In the "CONNECTIONS" panel, click "Edit Connections". This opens the connection manager page. Click "Add Connection".

### Postgres

Add the relevant database connection information. Once you click save, the password (if you have entered one) will be stored in your system keychain.

### BigQuery

Authenticating to BigQuery can be done either via oAuth (using your Google Cloud Account) or with a Service Account Key downloaded from Google Cloud

#### **Using oAuth**

To access BigQuery with the Malloy Plugin, you will need to have BigQuery credentials available, and the [gcloud CLI](https://cloud.google.com/sdk/gcloud) installed. Once it's installed, open a terminal and type the following:

```
gcloud auth login --update-adc
gcloud config set project {my_project_id} --installation
```

_Replace `{my_project_id}` with the **ID** of the bigquery project you want to use & bill to. If you're not sure what this ID is, open Cloud Console, and click on the dropdown at the top (just to the right of the "Google Cloud Platform" text) to view projects you have access to. If you don't already have a project, [create one](https://cloud.google.com/resource-manager/docs/creating-managing-projects)._

#### **Using Service Account Key**

Add the relevant account information to the new connection, and include the path to the [service account key](https://cloud.google.com/iam/docs/creating-managing-service-account-keys).

## 4. Test the connection

Press "test" on the connection to confirm that you have successfully connected to the database.

## 5. Write some Malloy!

It may be helpful to check out one of the walkthroughs under Documentation below, or try some of the BigQuery [sample models](https://github.com/looker-open-source/malloy/tree/main/samples) on public datasets available on the repo before getting started.

If you want to dive right in, create a file called `test.malloy` and try to create queries on your dataset - you can find examples [here](https://looker-open-source.github.io/malloy/documentation/language/basic.html)

# Join the Community

- Join the [**Malloy Slack Community!**](https://join.slack.com/t/malloy-community/shared_invite/zt-upi18gic-W2saeFu~VfaVM1~HIerJ7w) Use this community to ask questions, meet other Malloy users, and share ideas with one another.
- Use [**GitHub issues**](https://github.com/looker-open-source/malloy/issues) in this Repo to provide feedback, suggest improvements, report bugs, and start new discussions.

# Documentation

[Malloy Documentation](https://looker-open-source.github.io/malloy/)

- [Basics](https://looker-open-source.github.io/malloy/documentation/language/basic.html) - A quick introduction to the language
- [eCommerce Example Analysis](https://looker-open-source.github.io/malloy/documentation/examples/ecommerce.html) - a walkthrough of the basics on an ecommerce dataset
- [Flights Example Analysis](https://looker-open-source.github.io/malloy/documentation/examples/faa.html) - examples built on the NTSB flights public dataset
- [Modeling Walkthrough](https://looker-open-source.github.io/malloy/documentation/examples/iowa/iowa.html) - introduction to modeling via the Iowa liquor sales public data set

# Why do we need another data language?

SQL is complete but ugly: everything is expressible, but nothing is reusable; simple ideas are complex to express; the language is verbose and lacks smart defaults. Malloy is immediately understandable by SQL users, and far easier to use and learn.

Key features and advantages:

- Query and model in the same language - everything is reusable and extensible.
- Malloy reads the schema so you don’t need to model everything. Malloy allows creation of re-usable metrics and logic, but there’s no need for boilerplate code that doesn’t add anything new.
- Pipelining: output one query into the next easily for powerful advanced analysis.
- Aggregating Subqueries let you build nested data sets to delve deeper into data quickly, and return complicated networks of data from single queries (like GraphQL).
- Queries do more: Power an entire dashboard with a single query. Nested queries are batched together, scanning the data only once.
- Indexes for unified suggest/search: Malloy automatically builds search indexes, making it easier to understand a dataset and filter values.
- Built to optimize the database: make the most of BigQuery, utilizing BI engine, caching, reading/writing nested datasets extremely fast, and more.
- Malloy models are purely about data; visualization and “styles” configurations live separately, keeping the model clean and easy to read.
- Aggregates are safe and accurate: Malloy generates distinct keys when they’re needed to ensure it never fans out your data.
- Nested tables are made approachable: you don’t have to model or flatten them; specify a query path and Malloy handles the rest.
- Compiler-based error checking: Malloy understands sql expressions so the compiler catches errors as you write, before the query is run.

# Contributing

If you would like to [work on Malloy](CONTRIBUTING.md), you can find some helpful instructions about [developing Malloy](developing.md) and [developing documentation](documentation.md).

Malloy is not an officially supported Google product.
