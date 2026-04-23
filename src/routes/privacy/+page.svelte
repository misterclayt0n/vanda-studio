<script lang="ts">
	import LegalPage from "$lib/components/legal/LegalPage.svelte";

	const sections = [
		{
			title: "Visão geral",
			paragraphs: [
				"A Vanda Studio ajuda pessoas e empresas a criar, agendar e gerenciar conteúdo para redes sociais. Esta Política de Privacidade explica quais informações coletamos, como usamos essas informações e quais escolhas você tem.",
				"Ao usar a Vanda Studio, você concorda com a coleta e o uso das informações conforme descrito nesta política.",
			],
		},
		{
			title: "Informações que coletamos",
			items: [
				"Informações da conta, como nome, endereço de e-mail, imagem de perfil e identificadores de autenticação.",
				"Informações de projetos e marcas fornecidas por você, incluindo descrições da marca, preferências de conteúdo, legendas, mídias enviadas, imagens geradas e detalhes de agendamento.",
				"Informações de contas sociais quando você conecta uma plataforma como o Instagram, incluindo metadados do perfil, metadados de mídias, permissões concedidas, métricas da conta, métricas de publicações e status de publicação.",
				"Informações de uso e diagnóstico, como ações realizadas no app, erros, metadados de dispositivo/navegador e horários de atividade.",
			],
		},
		{
			title: "Como usamos as informações",
			items: [
				"Para fornecer e melhorar os recursos da Vanda Studio, incluindo geração de mídia, composição de posts, agendamento, análises e recomendações.",
				"Para conectar plataformas sociais com sua permissão e executar ações solicitadas por você, como importar dados da conta ou publicar conteúdo aprovado.",
				"Para manter a segurança, prevenir abusos, corrigir erros e oferecer suporte ao cliente.",
				"Para cumprir obrigações legais e requisitos das plataformas integradas.",
			],
		},
		{
			title: "Dados do Instagram e da Meta",
			paragraphs: [
				"Se você conectar uma conta profissional do Instagram, a Vanda Studio poderá acessar apenas as permissões aprovadas por você no fluxo de autorização da Meta. Isso pode incluir informações do perfil, informações de mídias, insights, comentários e permissões de publicação, dependendo dos recursos ativados.",
				"Nós não solicitamos sua senha do Instagram. Você pode revogar o acesso da Vanda Studio nas configurações da sua conta Meta ou Instagram.",
			],
		},
		{
			title: "Compartilhamento e operadores",
			paragraphs: [
				"Nós não vendemos suas informações pessoais. Podemos compartilhar informações com prestadores de serviço que nos ajudam a operar o produto, incluindo hospedagem, autenticação, banco de dados, pagamentos, geração por IA, armazenamento, análises e APIs de plataformas sociais.",
				"Esses prestadores estão autorizados a processar informações somente conforme necessário para prestar serviços à Vanda Studio.",
			],
		},
		{
			title: "Retenção de dados",
			paragraphs: [
				"Mantemos informações pelo tempo necessário para prestar o serviço, cumprir obrigações legais, resolver disputas e aplicar nossos acordos. Você pode solicitar a exclusão da sua conta ou de dados sociais conectados a qualquer momento.",
			],
		},
		{
			title: "Suas escolhas",
			items: [
				"Você pode atualizar ou excluir projetos e conteúdos dentro do app.",
				"Você pode desconectar contas sociais ou revogar permissões nas plataformas conectadas.",
				"Você pode solicitar a exclusão da conta ou de dados seguindo as instruções da nossa página de Exclusão de Dados.",
			],
		},
		{
			title: "Contato",
			paragraphs: [
				"Para dúvidas sobre privacidade ou solicitações de exclusão, entre em contato pelo canal de suporte indicado no app da Vanda Studio ou pelo e-mail de contato configurado para a Vanda Studio no Meta for Developers.",
			],
		},
	];
</script>

<LegalPage
	title="Política de Privacidade"
	description="Como a Vanda Studio coleta, usa, armazena e protege informações em seu serviço de gerenciamento de redes sociais."
	updatedAt="23 de abril de 2026"
	{sections}
/>
